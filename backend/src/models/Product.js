const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
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

module.exports = mongoose.model('Product', productSchema);