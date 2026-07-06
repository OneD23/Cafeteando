const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const InventoryMovement = require('../models/InventoryMovement');
const CashSessionState = require('../models/CashSessionState');
const Invoice = require('../models/Invoice');
const CashMovement = require('../models/CashMovement');
const CashRegister = require('../models/CashRegister');
const { protect } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/audit');
const AccountingEntry = require('../models/AccountingEntry');
const { expandIngredientRequirements, roundQuantity } = require('../utils/ingredientComposition');

const router = express.Router();

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const toAccountingDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
const normalizePaymentMethod = (method) => ['cash', 'card', 'transfer', 'mixed'].includes(String(method || '').toLowerCase()) ? String(method).toLowerCase() : 'cash';
const loadIngredientById = (session = null) => async (id) => Ingredient.findById(id).session(session);

const normalizeSelectedOptions = (product, selectedOptions = []) => {
  const groups = Array.isArray(product.options) ? product.options : [];
  const selections = Array.isArray(selectedOptions) ? selectedOptions : [];

  return selections.map((selection) => {
    const group = groups.find((candidate) => String(candidate.name) === String(selection.groupName));
    const value = group?.values?.find((candidate) => String(candidate.label) === String(selection.valueLabel));
    return {
      groupName: String(group?.name || selection.groupName || '').trim(),
      valueLabel: String(value?.label || selection.valueLabel || '').trim(),
      priceDelta: roundMoney(value ? value.priceDelta : selection.priceDelta || 0),
    };
  }).filter((selection) => selection.groupName && selection.valueLabel);
};

const calculateUnitPrice = (product, selectedOptions = []) =>
  roundMoney((product.price || 0) + selectedOptions.reduce((sum, option) => sum + Number(option.priceDelta || 0), 0));

const recoverAccountingCashFromLegacyState = async (userId, session) => {
  const legacyCashState = await CashSessionState.findOne({ key: 'default', isOpen: true }).session(session);
  if (!legacyCashState) return null;

  const existingRecovered = await CashRegister.findOne({ user: userId, branchId: 'default', status: 'open' }).session(session);
  if (existingRecovered) return existingRecovered;

  const now = legacyCashState.openedAt || new Date();
  const fechaContable = toAccountingDate(now);
  const openingAmount = roundMoney(legacyCashState.openingAmount || 0);
  const cash = await CashRegister.create([{
    user: userId,
    openedAt: now,
    openedFechaContable: fechaContable,
    openingAmount,
  }], { session, ordered: true });

  await CashMovement.create([{
    cashRegister: cash[0]._id,
    user: userId,
    cajero: userId,
    fecha: now,
    fechaContable,
    type: 'apertura',
    amount: openingAmount,
    paymentMethod: 'cash',
    reference: `LEGACY-OPEN-${cash[0]._id}`,
    description: 'Apertura recuperada desde caja fiscal legacy',
    sourceType: 'cash',
    sourceId: cash[0]._id,
  }], { session, ordered: true });

  await AccountingEntry.create([
    { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'in', type: 'apertura', category: 'cash', description: 'Efectivo inicial recuperado desde caja legacy', amount: openingAmount, debit: openingAmount, credit: 0, paymentMethod: 'cash', reference: `LEGACY-OPEN-${cash[0]._id}`, sourceType: 'cash', sourceId: cash[0]._id, cashRegister: cash[0]._id, user: userId },
    { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'in', type: 'apertura', category: 'other', description: 'Contrapartida apertura recuperada desde caja legacy', amount: openingAmount, debit: 0, credit: openingAmount, paymentMethod: 'cash', reference: `LEGACY-OPEN-${cash[0]._id}`, sourceType: 'cash', sourceId: cash[0]._id, cashRegister: cash[0]._id, user: userId },
  ], { session, ordered: true });

  return cash[0];
};

// @route   POST /api/sales
// @desc    Crear venta y descontar inventario
// @access  Private
router.post('/', protect, async (req, res) => {
  const session = await Sale.startSession();
  session.startTransaction();

  try {
    const { items, paymentMethod, customer, discount, deviceId, syncId, idempotencyKey } = req.body;
    const taxEnabled = req.body?.taxEnabled !== false;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('La venta requiere al menos un producto');
    }
    const requestKey = idempotencyKey || syncId;
    let cashRegister = await CashRegister.findOne({ user: req.user._id, branchId: 'default', status: 'open' }).session(session);
    if (!cashRegister) {
      cashRegister = await recoverAccountingCashFromLegacyState(req.user._id, session);
    }
    if (!cashRegister) {
      throw new Error('No se puede vender sin una caja abierta. Abre la caja en POS o Contabilidad antes de cobrar.');
    }

    if (requestKey) {
      const existing = await Sale.findOne({ $or: [{ idempotencyKey: requestKey }, { syncId: requestKey }] }).populate('invoice').session(session);
      if (existing) {
        await session.abortTransaction();
        return res.status(200).json({ success: true, data: existing, deduplicated: true });
      }
    }

    // Validar stock de ingredientes para cada item, expandiendo ingredientes compuestos
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      
      if (!product || !product.hasRecipe) continue;

      const recipe = await Recipe.findById(product.recipeId).session(session);
      if (!recipe) continue;

      const { requirements } = await expandIngredientRequirements(recipe.items, { loadIngredient: loadIngredientById(session) });
      for (const row of requirements) {
        const needed = roundQuantity(row.quantity * item.quantity);
        if (!row.ingredient || row.ingredient.stock < needed) {
          throw new Error(`Stock insuficiente: ${row.ingredient?.name || 'Ingrediente'} para ${product.name}`);
        }
      }
    }

    // Calcular totales
    let subtotal = 0;
    let totalCost = 0;
    const saleItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error('Producto no encontrado en la venta');
      const recipe = product?.recipeId ? await Recipe.findById(product.recipeId).session(session) : null;
      
      // Calcular costo expandiendo ingredientes compuestos
      let itemCost = 0;
      const expandedRecipe = recipe ? await expandIngredientRequirements(recipe.items, { loadIngredient: loadIngredientById(session) }) : { requirements: [] };
      for (const row of expandedRecipe.requirements) {
        itemCost += (row.ingredient?.costPerUnit || 0) * row.quantity;
      }

      itemCost = roundMoney(itemCost);

      const selectedOptions = normalizeSelectedOptions(product, item.selectedOptions);
      const unitPrice = calculateUnitPrice(product, selectedOptions);
      const itemTotal = roundMoney(unitPrice * item.quantity);
      subtotal = roundMoney(subtotal + itemTotal);
      totalCost = roundMoney(totalCost + (itemCost * item.quantity));

      saleItems.push({
        product: product._id,
        quantity: item.quantity,
        price: unitPrice,
        basePrice: product.price,
        selectedOptions,
        cost: itemCost,
        total: itemTotal
      });

      // Descontar ingredientes base; si un ingrediente es compuesto, se consumen sus componentes
      if (recipe) {
        for (const row of expandedRecipe.requirements) {
          const ingredient = await Ingredient.findById(row.ingredient._id).session(session);
          const deductQty = roundQuantity(row.quantity * item.quantity);
          const previousStock = ingredient.stock;

          ingredient.stock = roundQuantity(ingredient.stock - deductQty);
          await ingredient.save({ session });

          // Registrar movimiento
          await InventoryMovement.create([{
            type: 'recipe_deduction',
            ingredient: ingredient._id,
            quantity: -deductQty,
            previousStock,
            newStock: ingredient.stock,
            reason: `Venta: ${product.name}`,
            user: req.user._id,
            deviceId
          }], { session, ordered: true });
        }
      }

      // Actualizar estadísticas de producto
      product.salesCount += item.quantity;
      product.totalRevenue += itemTotal;
      await product.save({ session });
    }

    // Aplicar descuento
    let discountAmount = 0;
    if (discount && discount.type !== 'none') {
      discountAmount = discount.type === 'percentage'
        ? roundMoney(subtotal * (discount.value / 100))
        : roundMoney(Math.min(discount.value, subtotal));
    }

    const taxableBase = roundMoney(subtotal - discountAmount);
    const tax = taxEnabled ? roundMoney(taxableBase * 0.16) : 0;
    const total = roundMoney(taxableBase + tax);

    const now = new Date();
    const prefix = `SALE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const saleCount = await Sale.countDocuments({ saleId: new RegExp(`^${prefix}`) }).session(session);
    const generatedSaleId = `${prefix}-${String(saleCount + 1).padStart(4, '0')}`;

    // Crear venta
    const sale = await Sale.create([{
      saleId: generatedSaleId,
      items: saleItems,
      subtotal,
      discount: {
        type: discount?.type || 'none',
        value: discount?.value || 0,
        amount: discountAmount
      },
      tax,
      total,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      customer,
      cashier: req.user._id,
      cashRegister: cashRegister._id,
      syncId,
      idempotencyKey: requestKey,
      deviceId,
      offlineCreated: !!deviceId
    }], { session, ordered: true });

    const invoiceNumber = generatedSaleId.replace('SALE-', 'FAC-');
    const fechaContable = toAccountingDate(now);
    const invoice = await Invoice.create([{
      invoiceNumber,
      sale: sale[0]._id,
      cashRegister: cashRegister._id,
      cashier: req.user._id,
      fecha: now,
      fechaContable,
      customer: {
        name: customer?.name || 'Consumidor Final',
        email: customer?.email,
        phone: customer?.phone,
        cedula: customer?.cedula,
        rnc: customer?.rnc,
      },
      items: saleItems.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        basePrice: item.basePrice,
        selectedOptions: item.selectedOptions,
        cost: item.cost,
        total: item.total,
      })),
      subtotal,
      itbis: tax,
      discount: discountAmount,
      total,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      reference: generatedSaleId,
      status: 'emitida',
    }], { session, ordered: true });

    sale[0].invoice = invoice[0]._id;
    await sale[0].save({ session });

    await CashMovement.create([{
      cashRegister: cashRegister._id,
      user: req.user._id,
      cajero: req.user._id,
      fecha: now,
      fechaContable,
      type: 'venta',
      amount: total,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      reference: generatedSaleId,
      description: `Venta ${generatedSaleId}`,
      sourceType: 'sale',
      sourceId: sale[0]._id,
    }], { session, ordered: true });

    const accountingRows = [{
      date: now,
      fecha: now,
      dayKey: fechaContable,
      fechaContable,
      direction: 'in',
      type: 'venta',
      category: 'payment',
      description: `Cobro de venta (${generatedSaleId})`,
      amount: total,
      debit: total,
      credit: 0,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      reference: generatedSaleId,
      sourceType: 'sale',
      sourceId: sale[0]._id,
      cashRegister: cashRegister._id,
      user: req.user._id,
    }, {
      date: now,
      fecha: now,
      dayKey: fechaContable,
      fechaContable,
      direction: 'in',
      type: 'venta',
      category: 'sale',
      description: `Ingreso por venta (${generatedSaleId})`,
      amount: taxableBase,
      debit: 0,
      credit: taxableBase,
      paymentMethod: normalizePaymentMethod(paymentMethod),
      reference: generatedSaleId,
      sourceType: 'sale',
      sourceId: sale[0]._id,
      cashRegister: cashRegister._id,
      user: req.user._id,
    }];

    if (tax > 0) {
      accountingRows.push({
        date: now,
        fecha: now,
        dayKey: fechaContable,
        fechaContable,
        direction: 'in',
        type: 'venta',
        category: 'tax',
        description: `ITBIS por pagar (${generatedSaleId})`,
        amount: tax,
        debit: 0,
        credit: tax,
        paymentMethod: normalizePaymentMethod(paymentMethod),
        reference: generatedSaleId,
        sourceType: 'invoice',
        sourceId: invoice[0]._id,
        cashRegister: cashRegister._id,
        user: req.user._id,
      });
    }

    if (totalCost > 0) {
      accountingRows.push({
        date: now,
        fecha: now,
        dayKey: fechaContable,
        fechaContable,
        direction: 'out',
        type: 'venta',
        category: 'cogs',
        description: `Costo de venta (${generatedSaleId})`,
        amount: totalCost,
        debit: totalCost,
        credit: 0,
        reference: generatedSaleId,
        sourceType: 'sale',
        sourceId: sale[0]._id,
        cashRegister: cashRegister._id,
        user: req.user._id,
      }, {
        date: now,
        fecha: now,
        dayKey: fechaContable,
        fechaContable,
        direction: 'out',
        type: 'venta',
        category: 'inventory',
        description: `Salida de inventario por venta (${generatedSaleId})`,
        amount: totalCost,
        debit: 0,
        credit: totalCost,
        reference: generatedSaleId,
        sourceType: 'sale',
        sourceId: sale[0]._id,
        cashRegister: cashRegister._id,
        user: req.user._id,
      });
    }

    await AccountingEntry.create(accountingRows, { session, ordered: true });

    await session.commitTransaction();

    // Emitir eventos realtime
    req.app.get('io').emit('sale:created', {
      sale: sale[0],
      stats: {
        totalRevenue: total,
        invoice: invoice[0],
        totalCost,
        profit: roundMoney(total - totalCost)
      }
    });

    // Emitir actualización de inventario
    const updatedIngredients = await Ingredient.find({ isActive: true });
    req.app.get('io').emit('inventory:updated', updatedIngredients);

    res.status(201).json({
      success: true,
      data: { ...sale[0].toObject(), invoice: invoice[0] }
    });
    await logAuditEvent({
      req,
      module: 'sales',
      action: 'sale.created',
      metadata: { saleId: sale[0].saleId, total, paymentMethod: normalizePaymentMethod(paymentMethod), syncId: syncId || null }
    });

  } catch (error) {
    await logAuditEvent({
      req,
      module: 'sales',
      action: 'sale.create_failed',
      outcome: 'failure',
      metadata: { error: error.message }
    });
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
});

// @route   GET /api/sales
// @desc    Obtener ventas con filtros
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const query = {};
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const sales = await Sale.find(query)
      .populate('items.product', 'name icon')
      .populate('cashier', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Sale.countDocuments(query);

    // Calcular totales
    const stats = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          count: { $sum: 1 },
          averageTicket: { $avg: '$total' }
        }
      }
    ]);

    res.json({
      success: true,
      count,
      pages: Math.ceil(count / limit),
      currentPage: page,
      stats: stats[0] || { totalSales: 0, count: 0, averageTicket: 0 },
      data: sales
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/sales/dashboard
// @desc    Datos para dashboard
// @access  Private
router.get('/dashboard/stats', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ventas de hoy
    const todaySales = await Sale.aggregate([
      { $match: { createdAt: { $gte: today } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Productos más vendidos
    const topProducts = await Sale.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      }
    ]);

    // Alertas de stock bajo
    const lowStock = await Ingredient.find({
      $expr: { $lte: ['$stock', '$minStock'] }
    });

    res.json({
      success: true,
      data: {
        today: todaySales[0] || { total: 0, count: 0 },
        topProducts,
        lowStockAlerts: lowStock.length,
        lowStockItems: lowStock
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
