const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const InventoryMovement = require('../models/InventoryMovement');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/sales
// @desc    Crear venta y descontar inventario
// @access  Private
router.post('/', protect, async (req, res) => {
  const session = await Sale.startSession();
  session.startTransaction();

  try {
    const { items, paymentMethod, customer, discount, deviceId, syncId } = req.body;

    // Validar stock de ingredientes para cada item
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      
      if (!product || !product.hasRecipe) continue;

      const recipe = await Recipe.findById(product.recipeId).session(session);
      if (!recipe) continue;

      // Verificar cada ingrediente de la receta
      for (const recipeItem of recipe.items) {
        const ingredient = await Ingredient.findById(recipeItem.ingredientId).session(session);
        const needed = recipeItem.quantity * item.quantity;

        if (!ingredient || ingredient.stock < needed) {
          throw new Error(`Stock insuficiente: ${ingredient?.name || 'Ingrediente'} para ${product.name}`);
        }
      }
    }

    // Calcular totales
    let subtotal = 0;
    let totalCost = 0;
    const saleItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      const recipe = product?.recipeId ? await Recipe.findById(product.recipeId).session(session) : null;
      
      // Calcular costo
      let itemCost = 0;
      if (recipe) {
        for (const ri of recipe.items) {
          const ing = await Ingredient.findById(ri.ingredientId).session(session);
          itemCost += (ing?.costPerUnit || 0) * ri.quantity;
        }
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      totalCost += itemCost * item.quantity;

      saleItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
        cost: itemCost,
        total: itemTotal
      });

      // Descontar ingredientes
      if (recipe) {
        for (const ri of recipe.items) {
          const ingredient = await Ingredient.findById(ri.ingredientId).session(session);
          const deductQty = ri.quantity * item.quantity;
          const previousStock = ingredient.stock;

          ingredient.stock -= deductQty;
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
          }], { session });
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
        ? subtotal * (discount.value / 100)
        : Math.min(discount.value, subtotal);
    }

    const tax = (subtotal - discountAmount) * 0.16;
    const total = subtotal - discountAmount + tax;

    // Crear venta
    const sale = await Sale.create([{
      items: saleItems,
      subtotal,
      discount: {
        type: discount?.type || 'none',
        value: discount?.value || 0,
        amount: discountAmount
      },
      tax,
      total,
      paymentMethod,
      customer,
      cashier: req.user._id,
      syncId,
      deviceId,
      offlineCreated: !!deviceId
    }], { session });

    await session.commitTransaction();

    // Emitir eventos realtime
    req.app.get('io').emit('sale:created', {
      sale: sale[0],
      stats: {
        totalRevenue: total,
        totalCost,
        profit: total - totalCost
      }
    });

    // Emitir actualización de inventario
    const updatedIngredients = await Ingredient.find({ isActive: true });
    req.app.get('io').emit('inventory:updated', updatedIngredients);

    res.status(201).json({
      success: true,
      data: sale[0]
    });

  } catch (error) {
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