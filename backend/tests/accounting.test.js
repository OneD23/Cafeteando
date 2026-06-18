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
  assert.ok(CashMovement.schema.path('sourceType').enumValues.includes('closing'));
  assert.ok(Expense.schema.path('category'));
  assert.ok(CashRegister.schema.path('openingAmount'));
  assert.ok(DailyClosing.schema.path('expectedCash'));
  assert.ok(Sale.schema.path('idempotencyKey'));
  assert.ok(Sale.schema.path('cashRegister'));
  assert.ok(PaymentMethodSummary.schema.path('method'));
});

test('accounting entries preserve explicit zero debit/credit for balanced journals', async () => {
  const mongoose = require('mongoose');
  const AccountingEntry = require('../src/models/AccountingEntry');
  const user = new mongoose.Types.ObjectId();
  const base = {
    date: new Date('2026-05-28T12:00:00.000Z'),
    dayKey: '2026-05-28',
    fechaContable: '2026-05-28',
    type: 'venta',
    reference: 'FAC-TEST',
    user,
  };
  const rows = [
    new AccountingEntry({ ...base, direction: 'in', category: 'payment', description: 'Cobro', amount: 116, debit: 116, credit: 0 }),
    new AccountingEntry({ ...base, direction: 'in', category: 'sale', description: 'Ingreso', amount: 100, debit: 0, credit: 100 }),
    new AccountingEntry({ ...base, direction: 'in', category: 'tax', description: 'ITBIS', amount: 16, debit: 0, credit: 16 }),
    new AccountingEntry({ ...base, direction: 'out', category: 'cogs', description: 'Costo', amount: 40, debit: 40, credit: 0 }),
    new AccountingEntry({ ...base, direction: 'out', category: 'inventory', description: 'Inventario', amount: 40, debit: 0, credit: 40 }),
  ];
  await Promise.all(rows.map((row) => row.validate()));
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  assert.equal(totalDebit, totalCredit);
  assert.equal(rows[4].debit, 0);
  assert.equal(rows[0].credit, 0);
});

test('transactional array creates include ordered true for Mongoose sessions', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const routeFiles = [
    '../src/routes/accounting.js',
    '../src/routes/sales.js',
    '../src/routes/products.js',
    '../src/routes/ingredients.js',
  ];

  for (const routeFile of routeFiles) {
    const absolutePath = path.join(__dirname, routeFile);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const createCalls = source.match(/\.create\([\s\S]*?\);/g) || [];
    const unsafe = createCalls.filter((call) => call.includes('session') && !call.includes('ordered: true'));
    assert.deepEqual(unsafe, [], `${routeFile} tiene create() con session sin ordered: true`);
  }
});

test('Alegra-style catalog maps entries to auditable account lines', async () => {
  const mongoose = require('mongoose');
  const AccountingEntry = require('../src/models/AccountingEntry');
  const { ACCOUNT_GROUPS, ACCOUNT_CATALOG, buildAccountingLinesForEntry, getAccountCatalogTree, listAccountCatalog } = require('../src/utils/accounting');

  assert.deepEqual(Object.keys(ACCOUNT_GROUPS), ['assets', 'liabilities', 'equity', 'income', 'expenses', 'costs', 'memorandum']);
  assert.equal(ACCOUNT_CATALOG.cash.code, '110505');
  assert.equal(ACCOUNT_CATALOG.sales.nature, 'credit');
  assert.equal(ACCOUNT_CATALOG.cash.type, 'movement');
  assert.equal(ACCOUNT_CATALOG.cashEquivalent.type, 'control');
  assert.equal(ACCOUNT_CATALOG.cardReceivable.thirdPartyBalance, true);
  assert.ok(getAccountCatalogTree().find((account) => account.code === '1').children.length > 0);
  assert.ok(listAccountCatalog().some((account) => account.group === 'Cuentas de orden'));

  const cardPaymentLine = buildAccountingLinesForEntry({ category: 'payment', paymentMethod: 'card', debit: 116, credit: 0, description: 'Cobro tarjeta' });
  assert.equal(cardPaymentLine[0].account, ACCOUNT_CATALOG.cardReceivable.code);
  assert.equal(cardPaymentLine[0].debit, 116);

  const entry = new AccountingEntry({
    date: new Date('2026-05-28T12:00:00.000Z'),
    dayKey: '2026-05-28',
    direction: 'in',
    type: 'venta',
    category: 'sale',
    description: 'Ingreso POS',
    amount: 100,
    debit: 0,
    credit: 100,
    reference: 'FAC-LINES',
    user: new mongoose.Types.ObjectId(),
  });

  await entry.validate();
  assert.equal(entry.lines.length, 1);
  assert.equal(entry.lines[0].account, ACCOUNT_CATALOG.sales.code);
  assert.equal(entry.lines[0].credit, 100);
});

test('ingredient model supports composite ingredients and expanded requirements', async () => {
  const mongoose = require('mongoose');
  const Ingredient = require('../src/models/Ingredient');
  const InventoryMovement = require('../src/models/InventoryMovement');
  const { expandIngredientRequirements, calculateCompositeUnitCost } = require('../src/utils/ingredientComposition');

  assert.ok(Ingredient.schema.path('components'));
  assert.ok(InventoryMovement.schema.path('type').enumValues.includes('production'));
  assert.ok(InventoryMovement.schema.path('type').enumValues.includes('component_consumption'));

  const sugarId = new mongoose.Types.ObjectId();
  const milkId = new mongoose.Types.ObjectId();
  const syrupId = new mongoose.Types.ObjectId();
  const ingredients = new Map([
    [String(sugarId), { _id: sugarId, name: 'Azúcar', stock: 1000, costPerUnit: 0.02, components: [] }],
    [String(milkId), { _id: milkId, name: 'Leche', stock: 500, costPerUnit: 0.05, components: [] }],
    [String(syrupId), { _id: syrupId, name: 'Sirope', stock: 0, costPerUnit: 0, components: [{ ingredientId: sugarId, quantity: 2 }, { ingredientId: milkId, quantity: 3 }] }],
  ]);

  const loadIngredient = async (id) => ingredients.get(String(id));
  const expanded = await expandIngredientRequirements([{ ingredientId: syrupId, quantity: 4 }], { loadIngredient });
  assert.equal(expanded.requirements.find((row) => String(row.ingredient._id) === String(sugarId)).quantity, 8);
  assert.equal(expanded.requirements.find((row) => String(row.ingredient._id) === String(milkId)).quantity, 12);
  assert.equal(await calculateCompositeUnitCost(ingredients.get(String(syrupId)), { loadIngredient }), 0.19);
});
