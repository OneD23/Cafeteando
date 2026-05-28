const mongoose = require('mongoose');
const { EXPENSE_CATEGORIES } = require('../utils/accounting');

const expenseSchema = new mongoose.Schema({
  businessId: { type: String, index: true, default: 'default' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cashRegister: { type: mongoose.Schema.Types.ObjectId, ref: 'CashRegister', index: true },
  fecha: { type: Date, required: true, index: true },
  fechaContable: { type: String, required: true, index: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, enum: EXPENSE_CATEGORIES, default: 'otros', index: true },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'mixed'], default: 'cash', index: true },
  provider: { type: String, trim: true },
  receiptNumber: { type: String, trim: true },
  comprobanteUrl: { type: String, trim: true },
  reference: { type: String, trim: true, index: true },
  status: { type: String, enum: ['activo', 'anulado'], default: 'activo', index: true },
}, { timestamps: true });

expenseSchema.index({ fechaContable: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
