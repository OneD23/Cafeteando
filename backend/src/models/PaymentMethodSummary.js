const mongoose = require('mongoose');

const paymentMethodSummarySchema = new mongoose.Schema({
  businessId: { type: String, index: true, default: 'default' },
  fechaContable: { type: String, required: true, index: true },
  cashRegister: { type: mongoose.Schema.Types.ObjectId, ref: 'CashRegister', index: true },
  method: { type: String, enum: ['cash', 'card', 'transfer', 'mixed'], required: true, index: true },
  count: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['activo', 'cerrado'], default: 'activo', index: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

paymentMethodSummarySchema.index({ fechaContable: 1, method: 1, cashRegister: 1 });

module.exports = mongoose.model('PaymentMethodSummary', paymentMethodSummarySchema);
