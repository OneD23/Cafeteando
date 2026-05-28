const mongoose = require('mongoose');

const paymentSummarySchema = new mongoose.Schema({
  method: { type: String, enum: ['cash', 'card', 'transfer', 'mixed'], required: true },
  count: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const cashRegisterSchema = new mongoose.Schema({
  businessId: { type: String, index: true, default: 'default' },
  branchId: { type: String, index: true, default: 'default' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  openedAt: { type: Date, required: true },
  openedFechaContable: { type: String, required: true, index: true },
  openingAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  closedAt: Date,
  closedFechaContable: String,
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expectedCash: { type: Number, default: 0 },
  countedCash: { type: Number, default: 0 },
  difference: { type: Number, default: 0 },
  paymentMethods: [paymentSummarySchema],
  totals: {
    sales: { type: Number, default: 0 },
    expenses: { type: Number, default: 0 },
    entradas: { type: Number, default: 0 },
    salidas: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
  },
  observations: { type: String, trim: true },
}, { timestamps: true });

cashRegisterSchema.index({ user: 1, branchId: 1, status: 1 });
cashRegisterSchema.index({ openedFechaContable: 1, status: 1 });

module.exports = mongoose.model('CashRegister', cashRegisterSchema);
