const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const Sale = require('../models/Sale');
const CashSessionState = require('../models/CashSessionState');
const CashRegister = require('../models/CashRegister');
const CashMovement = require('../models/CashMovement');
const AccountingEntry = require('../models/AccountingEntry');
const DailyClosing = require('../models/DailyClosing');
const PaymentMethodSummary = require('../models/PaymentMethodSummary');
const { logAuditEvent } = require('../utils/audit');

const router = express.Router();

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toAccountingDate = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

const buildCashSummary = async (cashRegisterId) => {
  const match = { cashRegister: cashRegisterId, status: 'activo' };
  const [byType, paymentMethods] = await Promise.all([
    CashMovement.aggregate([{ $match: match }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    CashMovement.aggregate([{ $match: { ...match, type: 'venta' } }, { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $project: { method: '$_id', total: 1, count: 1, _id: 0 } }]),
  ]);
  const totalFor = (type) => roundMoney(byType.find((row) => row._id === type)?.total || 0);
  const entradas = totalFor('entrada') + totalFor('apertura');
  const gastos = totalFor('gasto');
  const salidas = totalFor('salida');
  const cierre = totalFor('cierre');
  const cashSales = paymentMethods.find((row) => row.method === 'cash')?.total || 0;
  const expectedCash = roundMoney(cashSales + entradas - gastos - salidas - cierre);
  return {
    expectedCash,
    paymentMethods,
    totals: { sales: totalFor('venta'), expenses: gastos, entradas, salidas, net: roundMoney(totalFor('venta') - gastos - salidas + entradas) },
  };
};

const getCashState = async () => {
  const existing = await CashSessionState.findOne({ key: 'default' });
  if (existing) return existing;
  return CashSessionState.create({ key: 'default' });
};

router.get('/cash-session', protect, async (req, res) => {
  const cashSession = await getCashState();
  res.json({ success: true, data: cashSession });
});

router.post('/cash-session/open', protect, async (req, res) => {
  const openingAmount = Number(req.body?.openingAmount || 0);
  if (!Number.isFinite(openingAmount) || openingAmount < 0) {
    return res.status(400).json({ success: false, message: 'Monto inicial inválido' });
  }

  const now = new Date();
  const cleanOpeningAmount = roundMoney(openingAmount);
  const cashSession = await CashSessionState.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        isOpen: true,
        openedAt: now,
        openedBy: req.user?.id || req.user?._id,
        openingAmount: cleanOpeningAmount,
      },
    },
    { upsert: true, new: true }
  );

  let cashRegister = await CashRegister.findOne({ user: req.user._id, branchId: 'default', status: 'open' });
  if (!cashRegister) {
    const fechaContable = toAccountingDate(now);
    cashRegister = await CashRegister.create({
      user: req.user._id,
      openedAt: now,
      openedFechaContable: fechaContable,
      openingAmount: cleanOpeningAmount,
    });
    await CashMovement.create({
      cashRegister: cashRegister._id,
      user: req.user._id,
      cajero: req.user._id,
      fecha: now,
      fechaContable,
      type: 'apertura',
      amount: cleanOpeningAmount,
      paymentMethod: 'cash',
      reference: `FISCAL-OPEN-${cashRegister._id}`,
      description: 'Apertura de caja desde ruta fiscal compatible',
      sourceType: 'cash',
      sourceId: cashRegister._id,
    });
    await AccountingEntry.create([
      { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'in', type: 'apertura', category: 'cash', description: 'Efectivo inicial en caja', amount: cleanOpeningAmount, debit: cleanOpeningAmount, credit: 0, paymentMethod: 'cash', reference: `FISCAL-OPEN-${cashRegister._id}`, sourceType: 'cash', sourceId: cashRegister._id, cashRegister: cashRegister._id, user: req.user._id },
      { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'in', type: 'apertura', category: 'other', description: 'Contrapartida apertura de caja', amount: cleanOpeningAmount, debit: 0, credit: cleanOpeningAmount, paymentMethod: 'cash', reference: `FISCAL-OPEN-${cashRegister._id}`, sourceType: 'cash', sourceId: cashRegister._id, cashRegister: cashRegister._id, user: req.user._id },
    ], { ordered: true });
  }

  await logAuditEvent({ req, module: 'cash', action: 'cash.opened', metadata: { openingAmount: cleanOpeningAmount, cashRegister: cashRegister._id } });
  res.json({ success: true, message: 'Apertura registrada', data: { ...cashSession.toObject(), cashRegister } });
});

router.post('/cash-session/close', protect, async (req, res) => {
  const cashRegister = await CashRegister.findOne({ user: req.user._id, branchId: 'default', status: 'open' });
  let closing = null;
  if (cashRegister) {
    const now = new Date();
    const fechaContable = toAccountingDate(now);
    const summary = await buildCashSummary(cashRegister._id);
    const countedCash = Number(req.body?.countedCash ?? req.body?.efectivoContado ?? summary.expectedCash);
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return res.status(400).json({ success: false, message: 'Efectivo contado inválido' });
    }
    const cleanCountedCash = roundMoney(countedCash);
    const difference = roundMoney(cleanCountedCash - summary.expectedCash);
    cashRegister.status = 'closed';
    cashRegister.closedAt = now;
    cashRegister.closedFechaContable = fechaContable;
    cashRegister.closedBy = req.user._id;
    cashRegister.expectedCash = summary.expectedCash;
    cashRegister.countedCash = cleanCountedCash;
    cashRegister.difference = difference;
    cashRegister.paymentMethods = summary.paymentMethods;
    cashRegister.totals = summary.totals;
    cashRegister.observations = req.body?.observations || 'Cierre desde ruta fiscal compatible';
    await cashRegister.save();
    closing = await DailyClosing.create({ fechaContable, cashRegister: cashRegister._id, user: cashRegister.user, closedBy: req.user._id, openedAt: cashRegister.openedAt, closedAt: now, openingAmount: cashRegister.openingAmount, expectedCash: summary.expectedCash, countedCash: cleanCountedCash, difference, salesTotal: summary.totals.sales, expensesTotal: summary.totals.expenses, entradasTotal: summary.totals.entradas, salidasTotal: summary.totals.salidas, netTotal: summary.totals.net, paymentMethods: summary.paymentMethods, observations: cashRegister.observations });
    if (summary.paymentMethods.length) {
      await PaymentMethodSummary.create(summary.paymentMethods.map((row) => ({ fechaContable, cashRegister: cashRegister._id, method: row.method || 'cash', count: row.count || 0, total: roundMoney(row.total || 0), status: 'cerrado', generatedBy: req.user._id })), { ordered: true });
    }
    await CashMovement.create({ cashRegister: cashRegister._id, user: req.user._id, cajero: cashRegister.user, fecha: now, fechaContable, type: 'cierre', amount: cleanCountedCash, paymentMethod: 'cash', reference: `FISCAL-CLOSE-${closing._id}`, description: 'Cierre de caja desde ruta fiscal compatible', sourceType: 'closing', sourceId: closing._id });
    await AccountingEntry.create([
      { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'out', type: 'cierre', category: 'cash', description: 'Retiro/control de efectivo por cierre fiscal compatible', amount: cleanCountedCash, debit: 0, credit: cleanCountedCash, paymentMethod: 'cash', reference: `FISCAL-CLOSE-${closing._id}`, sourceType: 'closing', sourceId: closing._id, cashRegister: cashRegister._id, user: req.user._id },
      { date: now, fecha: now, dayKey: fechaContable, fechaContable, direction: 'out', type: 'cierre', category: 'other', description: 'Contrapartida cierre fiscal compatible', amount: cleanCountedCash, debit: cleanCountedCash, credit: 0, paymentMethod: 'cash', reference: `FISCAL-CLOSE-${closing._id}`, sourceType: 'closing', sourceId: closing._id, cashRegister: cashRegister._id, user: req.user._id },
    ], { ordered: true });
  }

  const cashSession = await CashSessionState.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        isOpen: false,
        openedAt: null,
        openedBy: null,
        openingAmount: 0,
      },
    },
    { upsert: true, new: true }
  );
  await logAuditEvent({ req, module: 'cash', action: 'cash.closed', metadata: { cashRegister: cashRegister?._id, closing: closing?._id } });
  res.json({ success: true, message: 'Cierre registrado', data: { ...cashSession.toObject(), cashRegister, closing } });
});

router.post('/dgii/ecf/generate', protect, async (req, res) => {
  const { saleId, rnc, razonSocial, ncfType = 'B02' } = req.body || {};
  if (!saleId) return res.status(400).json({ success: false, message: 'saleId es requerido' });

  const sale = await Sale.findById(saleId);
  if (!sale) return res.status(404).json({ success: false, message: 'Venta no encontrada' });

  const ecf = {
    secuencia: `${ncfType}${Date.now().toString().slice(-8)}`,
    tipoComprobante: ncfType,
    rncComprador: rnc || null,
    razonSocialComprador: razonSocial || null,
    total: sale.total,
    fechaEmision: new Date().toISOString().slice(0, 10),
    estado: 'PENDIENTE_ENVIO_DGII',
  };

  res.json({
    success: true,
    message: 'e-CF generado (modo integración inicial)',
    data: ecf,
  });
});

router.post('/dgii/ecf/send', protect, restrictTo('admin', 'manager'), async (req, res) => {
  const { ecf } = req.body || {};
  if (!ecf?.secuencia) return res.status(400).json({ success: false, message: 'ecf.secuencia es requerido' });

  res.json({
    success: true,
    message: 'Integración DGII en modo sandbox/lista para proveedor certificador',
    data: {
      ...ecf,
      estado: 'ENVIADO_SIMULADO',
      trackId: `DGII-${Date.now()}`,
    },
  });
});

module.exports = router;
