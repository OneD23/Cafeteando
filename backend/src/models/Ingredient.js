const mongoose = require('mongoose');


const ingredientComponentSchema = new mongoose.Schema({
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  wastePercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
}, { _id: false });

const ingredientSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'El nombre es obligatorio'],
    trim: true,
    unique: true
  },
  unit: { 
    type: String, 
    required: true,
    enum: ['g', 'ml', 'unidad', 'oz'],
    default: 'g'
  },
  // Stock disponible en la greca / punto de preparación (se descuenta al vender)
  stock: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  // Stock de respaldo guardado en almacén (no se descuenta por ventas hasta transferirlo a la greca)
  warehouseStock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  minStock: { 
    type: Number, 
    required: true,
    default: 10,
    min: 0
  },
  costPerUnit: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  components: [ingredientComponentSchema],
  supplier: {
    type: String,
    trim: true
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
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
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para valor total del inventario
ingredientSchema.virtual('totalValue').get(function() {
  return (this.stock + this.warehouseStock) * this.costPerUnit;
});

ingredientSchema.virtual('isComposite').get(function() {
  return Array.isArray(this.components) && this.components.length > 0;
});

// Middleware pre-save para actualizar lastModified
ingredientSchema.pre('save', function(next) {
  this.lastModified = Date.now();
  next();
});

// Índices para búsqueda
ingredientSchema.index({ name: 'text' });
ingredientSchema.index({ stock: 1, minStock: 1 });
ingredientSchema.index({ warehouseStock: 1 }); // Para alertas de stock bajo

module.exports = mongoose.model('Ingredient', ingredientSchema);
