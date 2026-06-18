const express = require('express');
const AccountingEntry = require('../models/AccountingEntry');
const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const CashMovement = require('../models/CashMovement');
const Expense = require('../models/Expense');
const CashRegister = require('../models/CashRegister');
const DailyClosing = require('../models/DailyClosing');
const PaymentMethodSummary = require('../models/PaymentMethodSummary');
const CashSessionState = require('../models/CashSessionState');
const { protect, restrictTo } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/audit');
const {
  EXPENSE_CATEGORIES,
  roundMoney,
  toDate,
  toAccountingDate,
  dateRangeFromQuery,
  normalizePaymentMethod,
  assertPositiveAmount,
  buildPrintableHtml,
  objectIdOrNull,
  ACCOUNT_GROUPS,
  listAccountCatalog,
  getAccountCatalogTree,
} = require('../utils/accounting');

const router = express.Router();
const toDayKey = (d) => toAccountingDate(d);

const userDisplayName = (user) => user?.name || user?.username || 'Sistema';
const isPrivileged = (user) => ['admin', 'manager'].includes(user?.role);

const getOpenCashRegister = async (userId, session = null) => {
  const query = CashRegister.findOne({ user: userId, branchId: 'default', status: 'open' });
  return session ? query.session(session) : query;
};

const recoverOpenCashRegisterFromLegacyState = async (userId, session = null) => {
  const legacyQuery = CashSessionState.findOne({ key: 'default', isOpen: true });
  const legacyCashState = session ? await legacyQuery.session(session) : await legacyQuery;
  if (!legacyCashState) return null;

  const existingQuery = CashRegister.findOne({ user: userId, branchId: 'default', status: 'open' });
  const existingRecovered = session ? await existingQuery.session(session) : await existingQuery;
  if (existingRecovered) return existingRecovered;

  const now = legacyCashState.openedAt || new Date();
  const fechaContable = toAccountingDate(now);
  const openingAmount = roundMoney(legacyCashState.openingAmount || 0);
  const cashRows = await CashRegister.create([{
    user: userId,
    openedAt: now,
    openedFechaContable: fechaContable,
    openingAmount,
  }], session ? { session, ordered: true } : undefined);
  const cash = cashRows[0];

  await CashMovement.create([{
    cashRegister: cash._id,
    user: userId,
    cajero: userId,
    fecha: now,
    fechaContable,
    type: 'apertura',
    amount: openingAmount,
    paymentMethod: 'cash',
    reference: `LEGACY-OPEN-${cash._id}`,
    description: 'Apertura recuperada desde caja fiscal legacy',
    sourceType: 'cash',
    sourceId: cash._id,
  }], session ? { session, ordered: true } : undefined);

  await AccountingEntry.create([
    { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'in', type: 'apertura', category: 'cash', description: 'Efectivo inicial recuperado desde caja legacy', amount: openingAmount, debit: openingAmount, credit: 0, paymentMethod: 'cash', reference: `LEGACY-OPEN-${cash._id}`, sourceType: 'cash', sourceId: cash._id, cashRegister: cash._id, user: userId },
    { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'in', type: 'apertura', category: 'other', description: 'Contrapartida apertura recuperada desde caja legacy', amount: openingAmount, debit: 0, credit: openingAmount, paymentMethod: 'cash', reference: `LEGACY-OPEN-${cash._id}`, sourceType: 'cash', sourceId: cash._id, cashRegister: cash._id, user: userId },
  ], session ? { session, ordered: true } : undefined);

  return cash;
};

const buildCashSummary = async (cashRegisterId, session = null) => {
  const cashRegisterObjectId = objectIdOrNull(String(cashRegisterId));
  const match = { cashRegister: cashRegisterObjectId, status: 'activo' };
  const movementQuery = CashMovement.aggregate([
    { $match: match },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const paymentQuery = CashMovement.aggregate([
    { $match: { ...match, type: 'venta' } },
    { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $project: { method: '$_id', total: 1, count: 1, _id: 0 } },
  ]);
  if (session) {
    movementQuery.session(session);
    paymentQuery.session(session);
  }
  const [byType, paymentMethods] = await Promise.all([movementQuery, paymentQuery]);
  const totalFor = (type) => roundMoney(byType.find((row) => row._id === type)?.total || 0);
  const ventas = totalFor('venta');
  const gastos = totalFor('gasto');
  const entradas = totalFor('entrada') + totalFor('apertura');
  const salidas = totalFor('salida');
  const cierre = totalFor('cierre');
  const expectedCash = roundMoney((paymentMethods.find((row) => row.method === 'cash')?.total || 0) + entradas - gastos - salidas - cierre);
  return {
    byType,
    paymentMethods,
    totals: {
      sales: ventas,
      expenses: gastos,
      entradas,
      salidas,
      cierre,
      net: roundMoney(ventas - gastos - salidas + entradas),
    },
    expectedCash,
  };
};

const sendPrintable = (res, html, downloadName = 'cafeteando-reporte.html') => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
  res.send(html);
};


router.get('/catalog', protect, async (req, res) => {
  try {
    const accounts = listAccountCatalog();
    res.json({ success: true, count: accounts.length, groups: ACCOUNT_GROUPS, tree: getAccountCatalogTree(), data: accounts });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/trial-balance', protect, async (req, res) => {
  try {
    const match = { status: 'activo' };
    const dateRange = dateRangeFromQuery(req.query);
    if (dateRange) match.date = dateRange;
    const rows = await AccountingEntry.aggregate([
      { $match: match },
      { $project: {
        lines: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ['$lines', []] } }, 0] },
            '$lines',
            [{ account: '$category', description: '$description', debit: '$debit', credit: '$credit' }],
          ],
        },
      } },
      { $unwind: '$lines' },
      { $group: { _id: '$lines.account', debit: { $sum: '$lines.debit' }, credit: { $sum: '$lines.credit' }, movements: { $sum: 1 } } },
      { $project: { account: '$_id', debit: { $round: ['$debit', 2] }, credit: { $round: ['$credit', 2] }, balance: { $round: [{ $subtract: ['$debit', '$credit'] }, 2] }, movements: 1, _id: 0 } },
      { $sort: { account: 1 } },
    ]);
    const accountNames = listAccountCatalog().reduce((acc, account) => ({ ...acc, [account.code]: account }), {});
    const enriched = rows.map((row) => ({ ...row, name: accountNames[row.account]?.name || row.account, group: accountNames[row.account]?.group || 'Sin clasificar', nature: accountNames[row.account]?.nature || null }));
    const totalDebit = roundMoney(enriched.reduce((sum, row) => sum + row.debit, 0));
    const totalCredit = roundMoney(enriched.reduce((sum, row) => sum + row.credit, 0));
    const difference = roundMoney(totalDebit - totalCredit);
    res.json({ success: true, data: { accounts: enriched, totalDebit, totalCredit, difference, status: Math.abs(difference) < 0.01 ? 'cuadrado' : 'descuadrado' } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/dashboard', protect, async (req, res) => {
  try {
    const fechaContable = req.query.date || toAccountingDate();
    const dateRange = dateRangeFromQuery({ date: fechaContable });
    const [salesAgg, expenseAgg, invoiceCount, paymentAgg, productAgg, currentCash] = await Promise.all([
      Sale.aggregate([{ $match: { createdAt: dateRange, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 }, averageTicket: { $avg: '$total' } } }]),
      Expense.aggregate([{ $match: { fechaContable, status: 'activo' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Invoice.countDocuments({ fechaContable, status: 'emitida' }),
      Invoice.aggregate([{ $match: { fechaContable, status: 'emitida' } }, { $group: { _id: '$paymentMethod', total: { $sum: '$total' }, count: { $sum: 1 } } }]),
      Sale.aggregate([{ $match: { createdAt: dateRange, status: { $ne: 'cancelled' } } }, { $unwind: '$items' }, { $group: { _id: null, productsSold: { $sum: '$items.quantity' } } }]),
      getOpenCashRegister(req.user._id).then((cash) => cash || recoverOpenCashRegisterFromLegacyState(req.user._id)),
    ]);

    const sales = salesAgg[0] || { total: 0, count: 0, averageTicket: 0 };
    const expenses = expenseAgg[0] || { total: 0, count: 0 };
    const paymentTotal = (method) => roundMoney(paymentAgg.find((row) => row._id === method)?.total || 0);
    const cashSummary = currentCash ? await buildCashSummary(currentCash._id) : null;

    res.json({
      success: true,
      data: {
        fechaContable,
        salesToday: roundMoney(sales.total),
        expensesToday: roundMoney(expenses.total),
        netResult: roundMoney(sales.total - expenses.total),
        cashStatus: currentCash ? 'open' : 'closed',
        cashRegister: currentCash,
        invoicesIssued: invoiceCount,
        expectedCash: roundMoney(cashSummary?.expectedCash || 0),
        transfers: paymentTotal('transfer'),
        card: paymentTotal('card'),
        cash: paymentTotal('cash'),
        productsSold: productAgg[0]?.productsSold || 0,
        averageTicket: roundMoney(sales.averageTicket || 0),
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/entries', protect, async (req, res) => {
  try {
    const { direction, category, description, amount, date, reference, paymentMethod, type = 'manual' } = req.body;
    if (!direction || !category || !description || amount === undefined) {
      return res.status(400).json({ success: false, message: 'direction, category, description y amount son obligatorios' });
    }
    const dt = toDate(date);
    const cleanAmount = assertPositiveAmount(amount);
    const entry = await AccountingEntry.create({
      direction,
      category,
      description,
      amount: cleanAmount,
      debit: direction === 'out' ? cleanAmount : 0,
      credit: direction === 'in' ? cleanAmount : 0,
      paymentMethod: paymentMethod ? normalizePaymentMethod(paymentMethod) : null,
      date: dt,
      fecha: dt,
      dayKey: toDayKey(dt),
      fechaContable: toDayKey(dt),
      reference,
      type,
      sourceType: 'manual',
      user: req.user._id,
    });
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

router.get('/entries', protect, async (req, res) => {
  try {
    const { page = 1, limit = 50, category, type, paymentMethod } = req.query;
    const query = {};
    const dateRange = dateRangeFromQuery(req.query);
    if (dateRange) query.date = dateRange;
    if (category) query.category = category;
    if (type) query.type = type;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const rows = await AccountingEntry.find(query)
      .populate('user', 'name username role')
      .sort({ date: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const count = await AccountingEntry.countDocuments(query);

    res.json({ success: true, count, page: Number(page), pages: Math.ceil(count / Number(limit)), data: rows });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/journal', protect, async (req, res) => {
  try {
    const fechaContable = req.query.date || toAccountingDate();
    const rows = await AccountingEntry.find({ fechaContable, status: 'activo' })
      .populate('user', 'name username')
      .sort({ date: 1, createdAt: 1 });
    const totalDebit = roundMoney(rows.reduce((sum, row) => sum + Number(row.debit || (row.direction === 'out' ? row.amount : 0)), 0));
    const totalCredit = roundMoney(rows.reduce((sum, row) => sum + Number(row.credit || (row.direction === 'in' ? row.amount : 0)), 0));
    const difference = roundMoney(totalDebit - totalCredit);
    res.json({ success: true, data: { fechaContable, entries: rows, totalDebit, totalCredit, difference, status: Math.abs(difference) < 0.01 ? 'cuadrado' : 'descuadrado' } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/daily-journal', protect, async (req, res) => {
  try {
    const match = {};
    const dateRange = dateRangeFromQuery(req.query);
    if (dateRange) match.date = dateRange;

    const grouped = await AccountingEntry.aggregate([
      { $match: match },
      { $group: {
        _id: '$fechaContable',
        entries: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$amount', 0] } },
        exits: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$amount', 0] } },
        debit: { $sum: '$debit' },
        credit: { $sum: '$credit' },
        count: { $sum: 1 },
      }},
      { $project: { day: '$_id', entries: 1, exits: 1, debit: 1, credit: 1, result: { $subtract: ['$entries', '$exits'] }, difference: { $subtract: ['$debit', '$credit'] }, count: 1, _id: 0 } },
      { $sort: { day: -1 } },
    ]);

    res.json({ success: true, data: grouped });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/invoices', protect, async (req, res) => {
  try {
    const { text, invoiceNumber, customer, cashier, paymentMethod, status, page = 1, limit = 30 } = req.query;
    const query = {};
    const dateRange = dateRangeFromQuery(req.query);
    if (dateRange) query.fecha = dateRange;
    if (invoiceNumber) query.invoiceNumber = { $regex: String(invoiceNumber), $options: 'i' };
    if (customer) query['customer.name'] = { $regex: String(customer), $options: 'i' };
    if (cashier && objectIdOrNull(cashier)) query.cashier = objectIdOrNull(cashier);
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (status) query.status = status;
    if (text) {
      query.$or = [
        { invoiceNumber: { $regex: String(text), $options: 'i' } },
        { reference: { $regex: String(text), $options: 'i' } },
        { 'customer.name': { $regex: String(text), $options: 'i' } },
      ];
    }

    const rows = await Invoice.find(query)
      .populate('cashier', 'name username role')
      .sort({ fecha: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const count = await Invoice.countDocuments(query);

    res.json({ success: true, count, page: Number(page), pages: Math.ceil(count / Number(limit)), data: rows });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/invoices/:id', protect, async (req, res) => {
  try {
    const query = objectIdOrNull(req.params.id) ? { _id: req.params.id } : { invoiceNumber: req.params.id };
    const invoice = await Invoice.findOne(query).populate('cashier', 'name username role').populate('sale');
    if (!invoice) return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/invoices/:id/void', protect, restrictTo('admin', 'manager'), async (req, res) => {
  const session = await Invoice.startSession();
  session.startTransaction();
  try {
    const { reason } = req.body || {};
    if (!reason?.trim()) throw Object.assign(new Error('El motivo de anulación es obligatorio'), { statusCode: 400 });
    const invoice = await Invoice.findById(req.params.id).session(session);
    if (!invoice) throw Object.assign(new Error('Factura no encontrada'), { statusCode: 404 });
    if (invoice.status === 'anulada') throw Object.assign(new Error('La factura ya está anulada'), { statusCode: 400 });
    invoice.status = 'anulada';
    invoice.voidReason = reason.trim();
    invoice.voidedAt = new Date();
    invoice.voidedBy = req.user._id;
    await invoice.save({ session });
    await Sale.findByIdAndUpdate(invoice.sale, { status: 'cancelled' }, { session });
    await CashMovement.create([{ cashRegister: invoice.cashRegister, user: req.user._id, cajero: invoice.cashier, fecha: new Date(), fechaContable: toAccountingDate(), type: 'anulación', amount: invoice.total, paymentMethod: invoice.paymentMethod, reference: invoice.invoiceNumber, description: `Anulación factura ${invoice.invoiceNumber}: ${reason}`, sourceType: 'invoice', sourceId: invoice._id }], { session, ordered: true });
    const voidDate = new Date();
    const voidFechaContable = toAccountingDate(voidDate);
    const voidRows = [
      { date: voidDate, fecha: voidDate, dayKey: voidFechaContable, fechaContable: voidFechaContable, direction: 'out', type: 'anulación', category: 'sale', description: `Reverso ingreso factura ${invoice.invoiceNumber}`, amount: invoice.subtotal, debit: invoice.subtotal, credit: 0, paymentMethod: invoice.paymentMethod, reference: invoice.invoiceNumber, sourceType: 'invoice', sourceId: invoice._id, cashRegister: invoice.cashRegister, user: req.user._id },
      { date: voidDate, fecha: voidDate, dayKey: voidFechaContable, fechaContable: voidFechaContable, direction: 'out', type: 'anulación', category: 'payment', description: `Reverso cobro factura ${invoice.invoiceNumber}`, amount: invoice.total, debit: 0, credit: invoice.total, paymentMethod: invoice.paymentMethod, reference: invoice.invoiceNumber, sourceType: 'invoice', sourceId: invoice._id, cashRegister: invoice.cashRegister, user: req.user._id },
    ];
    if (invoice.itbis > 0) {
      voidRows.push({ date: voidDate, fecha: voidDate, dayKey: voidFechaContable, fechaContable: voidFechaContable, direction: 'out', type: 'anulación', category: 'tax', description: `Reverso ITBIS factura ${invoice.invoiceNumber}`, amount: invoice.itbis, debit: invoice.itbis, credit: 0, paymentMethod: invoice.paymentMethod, reference: invoice.invoiceNumber, sourceType: 'invoice', sourceId: invoice._id, cashRegister: invoice.cashRegister, user: req.user._id });
    }
    await AccountingEntry.create(voidRows, { session, ordered: true });
    await session.commitTransaction();
    await logAuditEvent({ req, module: 'accounting', action: 'invoice.voided', metadata: { invoiceNumber: invoice.invoiceNumber, reason } });
    res.json({ success: true, data: invoice });
  } catch (error) {
    await session.abortTransaction();
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

router.get('/movements', protect, async (req, res) => {
  try {
    const { type, cashier, page = 1, limit = 50 } = req.query;
    const query = {};
    const dateRange = dateRangeFromQuery(req.query);
    if (dateRange) query.fecha = dateRange;
    if (type) query.type = type;
    if (cashier && objectIdOrNull(cashier)) query.user = objectIdOrNull(cashier);
    const rows = await CashMovement.find(query).populate('user', 'name username role').sort({ fecha: -1, createdAt: -1 }).limit(Number(limit)).skip((Number(page) - 1) * Number(limit));
    const count = await CashMovement.countDocuments(query);
    const totalsByType = await CashMovement.aggregate([{ $match: query }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    res.json({ success: true, count, page: Number(page), pages: Math.ceil(count / Number(limit)), totalsByType, data: rows });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.post('/expenses', protect, async (req, res) => {
  const session = await Expense.startSession();
  session.startTransaction();
  try {
    const { description, category = 'otros', amount, paymentMethod = 'cash', provider, receiptNumber, comprobanteUrl, fecha } = req.body || {};
    if (!description?.trim()) throw Object.assign(new Error('La descripción del gasto es obligatoria'), { statusCode: 400 });
    if (!EXPENSE_CATEGORIES.includes(category)) throw Object.assign(new Error('Categoría de gasto inválida'), { statusCode: 400 });
    const cleanAmount = assertPositiveAmount(amount, 'El gasto debe tener un monto mayor a 0');
    const dt = toDate(fecha);
    const fechaContable = toAccountingDate(dt);
    const cashRegister = await getOpenCashRegister(req.user._id, session);
    if (normalizePaymentMethod(paymentMethod) === 'cash' && !cashRegister) throw Object.assign(new Error('No se puede registrar gasto en efectivo sin caja abierta'), { statusCode: 400 });
    const expense = await Expense.create([{ user: req.user._id, cashRegister: cashRegister?._id, fecha: dt, fechaContable, description: description.trim(), category, amount: cleanAmount, paymentMethod: normalizePaymentMethod(paymentMethod), provider, receiptNumber, comprobanteUrl, reference: `EXP-${Date.now()}` }], { session, ordered: true });
    await CashMovement.create([{ cashRegister: cashRegister?._id, user: req.user._id, cajero: req.user._id, fecha: dt, fechaContable, type: 'gasto', amount: cleanAmount, paymentMethod: normalizePaymentMethod(paymentMethod), reference: expense[0].reference, description: `Gasto: ${description.trim()}`, sourceType: 'expense', sourceId: expense[0]._id }], { session, ordered: true });
    await AccountingEntry.create([
      { date: dt, fecha: dt, dayKey: fechaContable, fechaContable, direction: 'out', type: 'gasto', category: 'expense', description: `Gasto ${category}: ${description.trim()}`, amount: cleanAmount, debit: cleanAmount, credit: 0, paymentMethod: normalizePaymentMethod(paymentMethod), reference: expense[0].reference, sourceType: 'expense', sourceId: expense[0]._id, cashRegister: cashRegister?._id, user: req.user._id },
      { date: dt, fecha: dt, dayKey: fechaContable, fechaContable, direction: 'out', type: 'gasto', category: 'payment', description: `Pago gasto ${category}: ${description.trim()}`, amount: cleanAmount, debit: 0, credit: cleanAmount, paymentMethod: normalizePaymentMethod(paymentMethod), reference: expense[0].reference, sourceType: 'expense', sourceId: expense[0]._id, cashRegister: cashRegister?._id, user: req.user._id },
    ], { session, ordered: true });
    await session.commitTransaction();
    res.status(201).json({ success: true, data: expense[0] });
  } catch (error) {
    await session.abortTransaction();
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

router.post('/cash/open', protect, async (req, res) => {
  const session = await CashRegister.startSession();
  session.startTransaction();
  try {
    const openingAmount = Number(req.body?.openingAmount || 0);
    if (!Number.isFinite(openingAmount) || openingAmount < 0) throw Object.assign(new Error('Monto inicial inválido'), { statusCode: 400 });
    const existing = await getOpenCashRegister(req.user._id, session);
    if (existing) throw Object.assign(new Error('Ya existe una caja abierta para este usuario'), { statusCode: 400 });
    const now = new Date();
    const fechaContable = toAccountingDate(now);
    const cash = await CashRegister.create([{ user: req.user._id, openedAt: now, openedFechaContable: fechaContable, openingAmount: roundMoney(openingAmount) }], { session, ordered: true });
    await CashMovement.create([{ cashRegister: cash[0]._id, user: req.user._id, cajero: req.user._id, fecha: now, fechaContable, type: 'apertura', amount: roundMoney(openingAmount), paymentMethod: 'cash', reference: `OPEN-${cash[0]._id}`, description: 'Apertura de caja', sourceType: 'cash', sourceId: cash[0]._id }], { session, ordered: true });
    await AccountingEntry.create([
      { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'in', type: 'apertura', category: 'cash', description: 'Efectivo inicial en caja', amount: roundMoney(openingAmount), debit: roundMoney(openingAmount), credit: 0, paymentMethod: 'cash', reference: `OPEN-${cash[0]._id}`, sourceType: 'cash', sourceId: cash[0]._id, cashRegister: cash[0]._id, user: req.user._id },
      { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'in', type: 'apertura', category: 'other', description: 'Contrapartida apertura de caja', amount: roundMoney(openingAmount), debit: 0, credit: roundMoney(openingAmount), paymentMethod: 'cash', reference: `OPEN-${cash[0]._id}`, sourceType: 'cash', sourceId: cash[0]._id, cashRegister: cash[0]._id, user: req.user._id },
    ], { session, ordered: true });
    await CashSessionState.findOneAndUpdate({ key: 'default' }, { $set: { isOpen: true, openedAt: now, openedBy: req.user._id, openingAmount: roundMoney(openingAmount) } }, { upsert: true, new: true, session });
    await session.commitTransaction();
    res.status(201).json({ success: true, message: 'Caja abierta', data: cash[0] });
  } catch (error) {
    await session.abortTransaction();
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

router.post('/cash/close', protect, async (req, res) => {
  const session = await CashRegister.startSession();
  session.startTransaction();
  try {
    const cash = await getOpenCashRegister(req.user._id, session);
    if (!cash) throw Object.assign(new Error('No hay caja abierta para cerrar'), { statusCode: 400 });
    const countedCash = Number(req.body?.countedCash ?? req.body?.efectivoContado ?? 0);
    if (!Number.isFinite(countedCash) || countedCash < 0) throw Object.assign(new Error('Efectivo contado inválido'), { statusCode: 400 });
    const summary = await buildCashSummary(cash._id, session);
    const now = new Date();
    const fechaContable = toAccountingDate(now);
    const difference = roundMoney(countedCash - summary.expectedCash);
    cash.status = 'closed';
    cash.closedAt = now;
    cash.closedFechaContable = fechaContable;
    cash.closedBy = req.user._id;
    cash.expectedCash = summary.expectedCash;
    cash.countedCash = roundMoney(countedCash);
    cash.difference = difference;
    cash.paymentMethods = summary.paymentMethods;
    cash.totals = summary.totals;
    cash.observations = req.body?.observations || '';
    await cash.save({ session });
    const closing = await DailyClosing.create([{ fechaContable, cashRegister: cash._id, user: cash.user, closedBy: req.user._id, openedAt: cash.openedAt, closedAt: now, openingAmount: cash.openingAmount, expectedCash: summary.expectedCash, countedCash: roundMoney(countedCash), difference, salesTotal: summary.totals.sales, expensesTotal: summary.totals.expenses, entradasTotal: summary.totals.entradas, salidasTotal: summary.totals.salidas, netTotal: summary.totals.net, paymentMethods: summary.paymentMethods, observations: cash.observations }], { session, ordered: true });
    if (summary.paymentMethods.length) {
      await PaymentMethodSummary.create(summary.paymentMethods.map((row) => ({
        fechaContable,
        cashRegister: cash._id,
        method: row.method || 'cash',
        count: row.count || 0,
        total: roundMoney(row.total || 0),
        status: 'cerrado',
        generatedBy: req.user._id,
      })), { session, ordered: true });
    }
    await CashMovement.create([{ cashRegister: cash._id, user: req.user._id, cajero: cash.user, fecha: now, fechaContable, type: 'cierre', amount: roundMoney(countedCash), paymentMethod: 'cash', reference: `CLOSE-${closing[0]._id}`, description: 'Cierre de caja', sourceType: 'closing', sourceId: closing[0]._id }], { session, ordered: true });
    await AccountingEntry.create([
      { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'out', type: 'cierre', category: 'cash', description: 'Retiro/control de efectivo por cierre', amount: roundMoney(countedCash), debit: 0, credit: roundMoney(countedCash), paymentMethod: 'cash', reference: `CLOSE-${closing[0]._id}`, sourceType: 'closing', sourceId: closing[0]._id, cashRegister: cash._id, user: req.user._id },
      { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'out', type: 'cierre', category: 'other', description: 'Contrapartida cierre de caja', amount: roundMoney(countedCash), debit: roundMoney(countedCash), credit: 0, paymentMethod: 'cash', reference: `CLOSE-${closing[0]._id}`, sourceType: 'closing', sourceId: closing[0]._id, cashRegister: cash._id, user: req.user._id },
    ], { session, ordered: true });
    await CashSessionState.findOneAndUpdate({ key: 'default' }, { $set: { isOpen: false, openedAt: null, openedBy: null, openingAmount: 0 } }, { upsert: true, new: true, session });
    await session.commitTransaction();
    res.json({ success: true, message: 'Caja cerrada', data: { cashRegister: cash, closing: closing[0] } });
  } catch (error) {
    await session.abortTransaction();
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

router.get('/cash/current', protect, async (req, res) => {
  try {
    const cash = await getOpenCashRegister(req.user._id) || await recoverOpenCashRegisterFromLegacyState(req.user._id);
    const summary = cash ? await buildCashSummary(cash._id) : null;
    res.json({ success: true, data: cash ? { ...cash.toObject(), summary } : null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/cash/closings', protect, async (req, res) => {
  try {
    const query = isPrivileged(req.user) ? {} : { user: req.user._id };
    const dateRange = dateRangeFromQuery(req.query);
    if (dateRange) query.closedAt = dateRange;
    const rows = await DailyClosing.find(query).populate('user', 'name username role').populate('closedBy', 'name username role').sort({ closedAt: -1 }).limit(Number(req.query.limit || 50));
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/:type/pdf', protect, async (req, res) => {
  try {
    const type = req.params.type;
    if (type === 'journal') {
      const fechaContable = req.query.date || toAccountingDate();
      const rows = await AccountingEntry.find({ fechaContable }).sort({ date: 1 });
      const html = buildPrintableHtml({ title: 'Diario contable', subtitle: `Asientos del ${fechaContable}`, generatedBy: userDisplayName(req.user), filters: { fechaContable }, columns: [{ key: 'date', label: 'Fecha', render: (r) => new Date(r.date).toLocaleString('es-DO') }, { key: 'description', label: 'Descripción' }, { key: 'category', label: 'Categoría' }, { key: 'debit', label: 'Debe', render: (r) => `$${Number(r.debit || 0).toFixed(2)}` }, { key: 'credit', label: 'Haber', render: (r) => `$${Number(r.credit || 0).toFixed(2)}` }], rows, totals: [{ label: 'Debe', value: `$${rows.reduce((s, r) => s + Number(r.debit || 0), 0).toFixed(2)}` }, { label: 'Haber', value: `$${rows.reduce((s, r) => s + Number(r.credit || 0), 0).toFixed(2)}` }], signature: true });
      return sendPrintable(res, html, `diario-${fechaContable}.html`);
    }
    return res.status(404).json({ success: false, message: 'Plantilla PDF no encontrada' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
