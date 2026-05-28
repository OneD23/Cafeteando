const test = require('node:test');
const assert = require('node:assert/strict');

test('accounting and reports route modules export routers for required endpoints', () => {
  const accountingRoutes = require('../src/routes/accounting');
  const reportRoutes = require('../src/routes/reports');
  assert.equal(typeof accountingRoutes, 'function');
  assert.equal(typeof accountingRoutes.use, 'function');
  assert.equal(typeof reportRoutes, 'function');
  assert.equal(typeof reportRoutes.use, 'function');
});

test('accounting utility validates dates, money and printable PDF HTML', () => {
  const { toAccountingDate, assertPositiveAmount, buildPrintableHtml } = require('../src/utils/accounting');
  assert.equal(toAccountingDate('2026-05-28T10:15:00.000Z'), '2026-05-28');
  assert.equal(assertPositiveAmount(10.235), 10.24);
  const html = buildPrintableHtml({
    title: 'Factura Cafeteando',
    generatedBy: 'Tester',
    filters: { fecha: '2026-05-28' },
    columns: [{ key: 'invoiceNumber', label: 'Factura' }, { key: 'total', label: 'Total' }],
    rows: [{ invoiceNumber: 'FAC-1', total: 100 }],
    totals: [{ label: 'Total', value: '$100.00' }],
    signature: true,
  });
  assert.match(html, /Factura Cafeteando/);
  assert.match(html, /Cafeteando/);
  assert.match(html, /FAC-1/);
  assert.match(html, /Revisado/);
});

test('new accounting models expose professional persistent fields and indexes', () => {
  const Invoice = require('../src/models/Invoice');
  const CashMovement = require('../src/models/CashMovement');
  const Expense = require('../src/models/Expense');
  const CashRegister = require('../src/models/CashRegister');
  const DailyClosing = require('../src/models/DailyClosing');
  const Sale = require('../src/models/Sale');
  const PaymentMethodSummary = require('../src/models/PaymentMethodSummary');

  assert.ok(Invoice.schema.path('invoiceNumber'));
  assert.ok(Invoice.schema.path('fechaContable'));
  assert.ok(CashMovement.schema.path('type'));
  assert.ok(Expense.schema.path('category'));
  assert.ok(CashRegister.schema.path('openingAmount'));
  assert.ok(DailyClosing.schema.path('expectedCash'));
  assert.ok(Sale.schema.path('idempotencyKey'));
  assert.ok(Sale.schema.path('cashRegister'));
  assert.ok(PaymentMethodSummary.schema.path('method'));
});
