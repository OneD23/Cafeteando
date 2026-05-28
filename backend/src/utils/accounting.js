const mongoose = require('mongoose');

const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'mixed'];
const CASH_MOVEMENT_TYPES = ['entrada', 'salida', 'venta', 'gasto', 'apertura', 'cierre', 'ajuste', 'anulación'];
const EXPENSE_CATEGORIES = ['hielo', 'vasos', 'servilletas', 'ingredientes', 'transporte', 'nómina', 'mantenimiento', 'otros'];

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toDate = (value, fieldName = 'fecha') => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} inválida`);
    error.statusCode = 400;
    throw error;
  }
  return date;
};

const toAccountingDate = (value = new Date()) => toDate(value).toISOString().slice(0, 10);

const startOfDay = (dateKey) => {
  const date = toDate(`${dateKey}T00:00:00.000Z`, 'fechaContable');
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (dateKey) => {
  const date = startOfDay(dateKey);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

const dateRangeFromQuery = (query = {}) => {
  const startKey = query.startDate || query.from || query.date;
  const endKey = query.endDate || query.to || query.date;
  const range = {};
  if (startKey) range.$gte = String(startKey).length === 10 ? startOfDay(startKey) : toDate(startKey, 'fecha inicio');
  if (endKey) range.$lte = String(endKey).length === 10 ? endOfDay(endKey) : toDate(endKey, 'fecha fin');
  return Object.keys(range).length ? range : null;
};

const normalizePaymentMethod = (method) => {
  const normalized = String(method || 'cash').toLowerCase();
  return PAYMENT_METHODS.includes(normalized) ? normalized : 'cash';
};

const assertPositiveAmount = (amount, message = 'El monto debe ser mayor a 0') => {
  const value = roundMoney(amount);
  if (!Number.isFinite(value) || value <= 0) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const buildPrintableHtml = ({ title, subtitle, generatedBy, filters = {}, columns = [], rows = [], totals = [], signature = false }) => {
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const generatedAt = new Date().toLocaleString('es-DO');
  const filterRows = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${safe(title)} - Cafeteando</title>
  <style>
    @page { margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #1f2933; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #7c4a2d; padding-bottom: 12px; margin-bottom: 18px; }
    .brand { font-size: 24px; font-weight: 800; color: #5b341f; }
    .meta { text-align: right; font-size: 12px; color: #52606d; line-height: 1.45; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .subtitle { color: #52606d; margin-bottom: 14px; }
    .filters, .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
    .pill { border: 1px solid #d9e2ec; border-radius: 8px; padding: 8px; font-size: 12px; background: #f8fafc; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th { background: #5b341f; color: white; text-align: left; padding: 8px; }
    td { border-bottom: 1px solid #e4e7eb; padding: 8px; }
    tr:nth-child(even) td { background: #fbfbfb; }
    .total { font-weight: 700; background: #fff7ed; }
    footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; color: #7b8794; display: flex; justify-content: space-between; border-top: 1px solid #d9e2ec; padding-top: 6px; }
    .signature { margin-top: 60px; display: flex; gap: 60px; }
    .signature div { flex: 1; border-top: 1px solid #52606d; padding-top: 8px; text-align: center; font-size: 12px; }
    @media print { button { display:none; } }
  </style>
</head>
<body>
  <header>
    <div><div class="brand">☕ Cafeteando</div><div>RNC: ${safe(process.env.BUSINESS_RNC || 'N/D')}</div></div>
    <div class="meta">Generado: ${safe(generatedAt)}<br/>Usuario: ${safe(generatedBy || 'Sistema')}<br/>Página <span class="pageNumber"></span></div>
  </header>
  <h1>${safe(title)}</h1>
  <div class="subtitle">${safe(subtitle || 'Reporte administrativo')}</div>
  ${filterRows.length ? `<section class="filters">${filterRows.map(([k, v]) => `<div class="pill"><strong>${safe(k)}:</strong> ${safe(v)}</div>`).join('')}</section>` : ''}
  <table>
    <thead><tr>${columns.map((col) => `<th>${safe(col.label || col.key)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${columns.map((col) => `<td>${safe(typeof col.render === 'function' ? col.render(row) : row[col.key])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length}">Sin datos para los filtros seleccionados.</td></tr>`}</tbody>
  </table>
  ${totals.length ? `<section class="totals">${totals.map((t) => `<div class="pill total"><strong>${safe(t.label)}:</strong> ${safe(t.value)}</div>`).join('')}</section>` : ''}
  ${signature ? '<section class="signature"><div>Preparado por</div><div>Revisado / Aprobado</div></section>' : ''}
  <footer><span>Cafeteando · Documento generado automáticamente</span><span>Filtros aplicados incluidos en encabezado</span></footer>
</body>
</html>`;
};

const objectIdOrNull = (id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

module.exports = {
  PAYMENT_METHODS,
  CASH_MOVEMENT_TYPES,
  EXPENSE_CATEGORIES,
  roundMoney,
  toDate,
  toAccountingDate,
  dateRangeFromQuery,
  normalizePaymentMethod,
  assertPositiveAmount,
  buildPrintableHtml,
  objectIdOrNull,
};
