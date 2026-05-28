const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  cost: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  businessId: { type: String, index: true, default: 'default' },
  invoiceNumber: { type: String, required: true, unique: true, index: true, trim: true },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', index: true },
  cashRegister: { type: mongoose.Schema.Types.ObjectId, ref: 'CashRegister', index: true },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fecha: { type: Date, required: true, index: true },
  fechaContable: { type: String, required: true, index: true },
  customer: {
    name: { type: String, trim: true, default: 'Consumidor Final' },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    cedula: { type: String, trim: true },
    rnc: { type: String, trim: true },
  },
  items: [invoiceItemSchema],
  subtotal: { type: Number, required: true, min: 0 },
  itbis: { type: Number, required: true, min: 0, default: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['cash', 'card', 'transfer', 'mixed'], required: true, index: true },
  status: { type: String, enum: ['emitida', 'anulada', 'pendiente'], default: 'emitida', index: true },
  reference: { type: String, trim: true, index: true },
  voidReason: { type: String, trim: true },
  voidedAt: Date,
  voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

invoiceSchema.index({ fechaContable: 1, invoiceNumber: 1 });
invoiceSchema.index({ 'customer.name': 'text', invoiceNumber: 'text', reference: 'text' });

module.exports = mongoose.model('Invoice', invoiceSchema);
