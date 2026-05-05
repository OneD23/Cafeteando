const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  saleId: {
    type: String,
    unique: true,
    required: true
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  discount: {
    type: { type: String, enum: ['percentage', 'fixed', 'none'], default: 'none' },
    value: { type: Number, default: 0 },
    amount: { type: Number, default: 0 }
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'mixed'],
    required: true
  },
  customer: {
    name: String,
    email: String,
    phone: String
  },
  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'refunded'],
    default: 'completed'
  },
  syncId: String,
  deviceId: String, // Para tracking de dispositivo móvil
  offlineCreated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Pre-save para generar saleId único
saleSchema.pre('save', async function(next) {
  if (!this.saleId) {
    const date = new Date();
    const prefix = `SALE-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const count = await mongoose.model('Sale').countDocuments({
      saleId: new RegExp(`^${prefix}`)
    });
    this.saleId = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Método para calcular ganancia
saleSchema.methods.calculateProfit = function() {
  const totalCost = this.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  return this.total - totalCost;
};

module.exports = mongoose.model('Sale', saleSchema);
