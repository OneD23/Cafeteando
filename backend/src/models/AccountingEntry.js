const mongoose = require('mongoose');

const accountingLineSchema = new mongoose.Schema({
  account: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
}, { _id: false });

const accountingEntrySchema = new mongoose.Schema({
  businessId: { type: String, index: true, default: 'default' },
  date: { type: Date, required: true, index: true },
  fecha: { type: Date, index: true },
  dayKey: { type: String, required: true, index: true }, // YYYY-MM-DD legacy
  fechaContable: { type: String, index: true },
  direction: { type: String, enum: ['in', 'out'], required: true },
  type: { type: String, enum: ['venta', 'gasto', 'apertura', 'cierre', 'ajuste', 'anulación', 'manual'], default: 'manual', index: true },
  category: { type: String, enum: ['sale', 'tax', 'cash', 'payment', 'cogs', 'inventory', 'expense', 'adjustment', 'void', 'other'], required: true },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'mixed', null], default: null, index: true },
  reference: { type: String, trim: true, index: true },
  status: { type: String, enum: ['activo', 'anulado'], default: 'activo', index: true },
  sourceType: { type: String, enum: ['sale', 'invoice', 'expense', 'manual', 'cash', 'closing'], default: 'manual' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  cashRegister: { type: mongoose.Schema.Types.ObjectId, ref: 'CashRegister', index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lines: [accountingLineSchema],
}, { timestamps: true });

accountingEntrySchema.pre('validate', function(next) {
  this.fecha = this.fecha || this.date;
  this.fechaContable = this.fechaContable || this.dayKey;
  this.debit = this.debit ?? (this.direction === 'out' ? this.amount : 0);
  this.credit = this.credit ?? (this.direction === 'in' ? this.amount : 0);
  next();
});

accountingEntrySchema.index({ dayKey: 1, createdAt: -1 });
accountingEntrySchema.index({ fechaContable: 1, createdAt: -1 });
accountingEntrySchema.index({ category: 1, date: -1 });
accountingEntrySchema.index({ type: 1, fechaContable: 1 });

module.exports = mongoose.model('AccountingEntry', accountingEntrySchema);
