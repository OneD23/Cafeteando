const mongoose = require('mongoose');


const productOptionValueSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true
  },
  priceDelta: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const productOptionGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  required: {
    type: Boolean,
    default: false
  },
  values: [productOptionValueSchema]
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  sku: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['coffee', 'pastry', 'drink', 'food'],
    default: 'coffee'
  },
  icon: {
    type: String,
    default: '☕'
  },
  image: String,
  options: [productOptionGroupSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  hasRecipe: {
    type: Boolean,
    default: true
  },
  recipeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  },
  syncId: {
    type: String,
    unique: true,
    sparse: true
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  salesCount: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índices
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: 'text' });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Product', productSchema);
