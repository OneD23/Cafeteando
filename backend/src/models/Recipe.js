const mongoose = require('mongoose');

const recipeItemSchema = new mongoose.Schema({
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const recipeSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true
  },
  items: [recipeItemSchema],
  preparationTime: {
    type: Number,
    default: 2,
    min: 0
  },
  instructions: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  syncId: String,
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Método para calcular costo total de la receta
recipeSchema.methods.calculateCost = async function() {
  await this.populate('items.ingredientId');
  return this.items.reduce((total, item) => {
    const ingredient = item.ingredientId;
    return total + (ingredient ? ingredient.costPerUnit * item.quantity : 0);
  }, 0);
};

module.exports = mongoose.model('Recipe', recipeSchema);
