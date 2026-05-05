const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['sale', 'restock', 'adjustment', 'waste', 'recipe_deduction'],
    required: true
  },
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },
  recipeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceId: String,
  syncId: String,
  offlineCreated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InventoryMovement', movementSchema);