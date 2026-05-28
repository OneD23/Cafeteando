const express = require('express');
const Sale = require('../models/Sale');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const CashMovement = require('../models/CashMovement');
const Ingredient = require('../models/Ingredient');
const ReportSnapshot = require('../models/ReportSnapshot');
const { protect } = require('../middleware/auth');
const { roundMoney, toAccountingDate, dateRangeFromQuery, buildPrintableHtml } = require('../utils/accounting');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const userDisplayName = (user) => user?.name || user?.username || 'Sistema';

const periodRange = (type, query = {}) => {
  if (query.startDate || query.endDate || query.date) return dateRangeFromQuery(query);
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (type === 'daily') {
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
  } else if (type === 'monthly') {
    start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
    end.setUTCMonth(end.getUTCMonth() + 1, 0); end.setUTCHours(23, 59, 59, 999);
  } else {
    start.setUTCDate(start.getUTCDate() - 6); start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
  }
  return { $gte: start, $lte: end };
};

const salesMatch = (range) => ({ createdAt: range, status: { $ne: 'cancelled' } });
const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const buildGeneralReport = async (type, query = {}) => {
  const range = periodRange(type, query);
  const invoiceQuery = { fecha: range };
  const expenseQuery = { fecha: range, status: 'activo' };
  const [sales, invoices, expenses, payments, products, cashMovements] = await Promise.all([
    Sale.aggregate([{ $match: salesMatch(range) }, { $group: { _id: null, total: { $sum: '$total' }, subtotal: { $sum: '$subtotal' }, tax: { $sum: '$tax' }, discount: { $sum: '$discount.amount' }, count: { $sum: 1 }, avgTicket: { $avg: '$total' } } }]),
    Invoice.find(invoiceQuery).sort({ fecha: -1 }).limit(200),
    Expense.aggregate([{ $match: expenseQuery }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Invoice.aggregate([{ $match: { ...invoiceQuery, status: 'emitida' } }, { $group: { _id: '$paymentMethod', total: { $sum: '$total' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Sale.aggregate([{ $match: salesMatch(range) }, { $unwind: '$items' }, { $group: { _id: '$items.product', quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.total' }, cost: { $sum: { $multiply: ['$items.cost', '$items.quantity'] } } } }, { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } }, { $project: { product: { $first: '$product.name' }, quantity: 1, revenue: 1, cost: 1, profit: { $subtract: ['$revenue', '$cost'] } } }, { $sort: { quantity: -1 } }, { $limit: 20 }]),
    CashMovement.aggregate([{ $match: { fecha: range, status: 'activo' } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  const salesSummary = sales[0] || { total: 0, subtotal: 0, tax: 0, discount: 0, count: 0, avgTicket: 0 };
  const expenseTotal = expenses.reduce((sum, row) => sum + row.total, 0);
  return {
    range,
    summary: {
      salesTotal: roundMoney(salesSummary.total),
      subtotal: roundMoney(salesSummary.subtotal),
      itbis: roundMoney(salesSummary.tax),
      discounts: roundMoney(salesSummary.discount),
      salesCount: salesSummary.count,
      averageTicket: roundMoney(salesSummary.avgTicket),
      expensesTotal: roundMoney(expenseTotal),
      netResult: roundMoney(salesSummary.total - expenseTotal),
      invoicesCount: invoices.length,
      productsSold: products.reduce((sum, row) => sum + row.quantity, 0),
    },
    invoices,
    expenses,
    payments,
    products,
    cashMovements,
  };
};

const persistSnapshot = async (type, report, user) => ReportSnapshot.create({
  type,
  fechaContable: toAccountingDate(),
  filters: { startDate: report.range?.$gte, endDate: report.range?.$lte },
  summary: report.summary,
  rows: [...(report.invoices || []), ...(report.expenses || []), ...(report.payments || [])].slice(0, 250),
  generatedBy: user?._id,
});

router.get('/daily', protect, asyncHandler(async (req, res) => {
  const report = await buildGeneralReport('daily', req.query);
  await persistSnapshot('daily', report, req.user);
  res.json({ success: true, data: report });
}));

router.get('/weekly', protect, asyncHandler(async (req, res) => {
  const report = await buildGeneralReport('weekly', req.query);
  await persistSnapshot('weekly', report, req.user);
  res.json({ success: true, data: report });
}));

router.get('/monthly', protect, asyncHandler(async (req, res) => {
  const report = await buildGeneralReport('monthly', req.query);
  await persistSnapshot('monthly', report, req.user);
  res.json({ success: true, data: report });
}));

router.get('/range', protect, asyncHandler(async (req, res) => {
  const report = await buildGeneralReport('range', req.query);
  await persistSnapshot('range', report, req.user);
  res.json({ success: true, data: report });
}));

router.get('/expenses', protect, asyncHandler(async (req, res) => {
  const range = periodRange('range', req.query);
  const rows = await Expense.find({ fecha: range, status: 'activo' }).populate('user', 'name username').sort({ fecha: -1 });
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  res.json({ success: true, data: { rows, summary: { total: roundMoney(total), count: rows.length } } });
}));

router.get('/products', protect, asyncHandler(async (req, res) => {
  const range = periodRange('range', req.query);
  const rows = await Sale.aggregate([{ $match: salesMatch(range) }, { $unwind: '$items' }, { $group: { _id: '$items.product', quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.total' }, cost: { $sum: { $multiply: ['$items.cost', '$items.quantity'] } } } }, { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } }, { $project: { product: { $first: '$product.name' }, quantity: 1, revenue: 1, cost: 1, profit: { $subtract: ['$revenue', '$cost'] } } }, { $sort: { quantity: -1 } }]);
  res.json({ success: true, data: { rows, summary: { products: rows.length, quantity: rows.reduce((s, r) => s + r.quantity, 0), revenue: roundMoney(rows.reduce((s, r) => s + r.revenue, 0)) } } });
}));

router.get('/inventory', protect, asyncHandler(async (req, res) => {
  const rows = await Ingredient.find({ isActive: true }).sort({ name: 1 });
  const lowStock = rows.filter((row) => Number(row.stock || 0) <= Number(row.minStock || 0));
  res.json({ success: true, data: { rows, summary: { totalItems: rows.length, lowStock: lowStock.length } } });
}));

router.get('/cash', protect, asyncHandler(async (req, res) => {
  const range = periodRange('range', req.query);
  const rows = await CashMovement.find({ fecha: range }).populate('user', 'name username').sort({ fecha: -1 });
  const totalsByType = await CashMovement.aggregate([{ $match: { fecha: range } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  res.json({ success: true, data: { rows, totalsByType } });
}));

router.get('/:type/pdf', protect, async (req, res) => {
  try {
    const type = req.params.type;
    let report;
    let title;
    let columns;
    let rows;
    let totals;
    if (['daily', 'weekly', 'monthly', 'range', 'general'].includes(type)) {
      report = await buildGeneralReport(type === 'general' ? 'range' : type, req.query);
      title = type === 'monthly' ? 'Reporte mensual' : type === 'daily' ? 'Reporte diario' : type === 'weekly' ? 'Reporte semanal' : 'Reporte general';
      rows = report.invoices;
      columns = [{ key: 'invoiceNumber', label: 'Factura' }, { key: 'fecha', label: 'Fecha', render: (r) => new Date(r.fecha).toLocaleString('es-DO') }, { key: 'customer', label: 'Cliente', render: (r) => r.customer?.name || 'Consumidor Final' }, { key: 'paymentMethod', label: 'Pago' }, { key: 'total', label: 'Total', render: (r) => money(r.total) }];
      totals = [{ label: 'Ventas', value: money(report.summary.salesTotal) }, { label: 'Gastos', value: money(report.summary.expensesTotal) }, { label: 'Resultado', value: money(report.summary.netResult) }];
    } else if (type === 'expenses') {
      const range = periodRange('range', req.query);
      rows = await Expense.find({ fecha: range, status: 'activo' }).sort({ fecha: -1 });
      title = 'Reporte de gastos';
      columns = [{ key: 'fecha', label: 'Fecha', render: (r) => new Date(r.fecha).toLocaleString('es-DO') }, { key: 'category', label: 'Categoría' }, { key: 'description', label: 'Descripción' }, { key: 'paymentMethod', label: 'Pago' }, { key: 'amount', label: 'Monto', render: (r) => money(r.amount) }];
      totals = [{ label: 'Gastos', value: money(rows.reduce((s, r) => s + r.amount, 0)) }];
    } else if (type === 'inventory') {
      rows = await Ingredient.find({ isActive: true }).sort({ name: 1 });
      title = 'Reporte de inventario';
      columns = [{ key: 'name', label: 'Ingrediente' }, { key: 'stock', label: 'Stock' }, { key: 'unit', label: 'Unidad' }, { key: 'minStock', label: 'Mínimo' }, { key: 'costPerUnit', label: 'Costo', render: (r) => money(r.costPerUnit) }];
      totals = [{ label: 'Items', value: rows.length }];
    } else {
      return res.status(404).json({ success: false, message: 'Tipo de reporte no soportado' });
    }

    const html = buildPrintableHtml({
      title,
      subtitle: 'Documento listo para imprimir o guardar como PDF',
      generatedBy: userDisplayName(req.user),
      filters: { inicio: req.query.startDate || req.query.date || 'auto', fin: req.query.endDate || req.query.date || 'auto' },
      columns,
      rows,
      totals,
      signature: ['daily', 'monthly', 'general'].includes(type),
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="cafeteando-${type}.html"`);
    res.send(html);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
