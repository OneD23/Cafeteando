const mongoose = require('mongoose');
const { CASH_MOVEMENT_TYPES } = require('../utils/accounting');

const cashMovementSchema = new mongoose.Schema({
  businessId: { type: String, index: true, default: 'default' },
  cashRegister: { type: mongoose.Schema.Types.ObjectId, ref: 'CashRegister', index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cajero: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  fecha: { type: Date, required: true, index: true },
  fechaContable: { type: String, required: true, index: true },
  type: { type: String, enum: CASH_MOVEMENT_TYPES, required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'mixed'], default: 'cash', index: true },
  reference: { type: String, trim: true, index: true },
  description: { type: String, trim: true, required: true },
  status: { type: String, enum: ['activo', 'anulado'], default: 'activo', index: true },
  sourceType: { type: String, enum: ['sale', 'invoice', 'expense', 'cash', 'closing', 'manual'], default: 'manual' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
}, { timestamps: true });

cashMovementSchema.index({ fechaContable: 1, type: 1 });

module.exports = mongoose.model('CashMovement', cashMovementSchema);
