const mongoose = require('mongoose');

const paymentSummarySchema = new mongoose.Schema({
  method: { type: String, enum: ['cash', 'card', 'transfer', 'mixed'], required: true },
  count: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const dailyClosingSchema = new mongoose.Schema({
  businessId: { type: String, index: true, default: 'default' },
  fechaContable: { type: String, required: true, index: true },
  cashRegister: { type: mongoose.Schema.Types.ObjectId, ref: 'CashRegister', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  openedAt: Date,
  closedAt: { type: Date, required: true },
  openingAmount: { type: Number, default: 0 },
  expectedCash: { type: Number, default: 0 },
  countedCash: { type: Number, default: 0 },
  difference: { type: Number, default: 0 },
  salesTotal: { type: Number, default: 0 },
  expensesTotal: { type: Number, default: 0 },
  entradasTotal: { type: Number, default: 0 },
  salidasTotal: { type: Number, default: 0 },
  netTotal: { type: Number, default: 0 },
  paymentMethods: [paymentSummarySchema],
  observations: { type: String, trim: true },
  status: { type: String, enum: ['cerrado', 'reabierto'], default: 'cerrado' },
}, { timestamps: true });

dailyClosingSchema.index({ fechaContable: 1, user: 1 });

module.exports = mongoose.model('DailyClosing', dailyClosingSchema);
