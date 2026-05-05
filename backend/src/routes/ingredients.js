const express = require('express');
const Ingredient = require('../models/Ingredient');
const InventoryMovement = require('../models/InventoryMovement');
const Recipe = require('../models/Recipe');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/ingredients
// @desc    Obtener todos los ingredientes
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const ingredients = await Ingredient.find({ isActive: true })
      .sort({ name: 1 });

    res.json({
      success: true,
      count: ingredients.length,
      data: ingredients
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/ingredients/low-stock
// @desc    Obtener ingredientes con stock bajo
// @access  Private
router.get('/low-stock', protect, async (req, res) => {
  try {
    const ingredients = await Ingredient.find({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true
    });

    res.json({
      success: true,
      count: ingredients.length,
      data: ingredients
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/ingredients
// @desc    Crear ingrediente
// @access  Private/Admin/Manager
router.post('/', protect, async (req, res) => {
  try {
    const ingredient = await Ingredient.create({
      ...req.body,
      modifiedBy: req.user._id
    });

    // Emitir evento realtime
    req.app.get('io').emit('ingredient:created', ingredient);

    res.status(201).json({
      success: true,
      data: ingredient
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/ingredients/:id
// @desc    Actualizar ingrediente
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const ingredient = await Ingredient.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        modifiedBy: req.user._id,
        lastModified: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: 'Ingrediente no encontrado'
      });
    }

    // Emitir evento realtime
    req.app.get('io').emit('ingredient:updated', ingredient);

    res.json({
      success: true,
      data: ingredient
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/ingredients/:id/restock
// @desc    Reponer stock
// @access  Private
router.post('/:id/restock', protect, async (req, res) => {
  const session = await Ingredient.startSession();
  session.startTransaction();

  try {
    const { quantity, reason } = req.body;
    const ingredient = await Ingredient.findById(req.params.id).session(session);

    if (!ingredient) {
      throw new Error('Ingrediente no encontrado');
    }

    const previousStock = ingredient.stock;
    ingredient.stock += quantity;
    ingredient.lastRestocked = new Date();
    await ingredient.save({ session });

    // Crear movimiento
    await InventoryMovement.create([{
      type: 'restock',
      ingredient: ingredient._id,
      quantity,
      previousStock,
      newStock: ingredient.stock,
      reason: reason || 'Reposición manual',
      user: req.user._id
    }], { session });

    await session.commitTransaction();

    // Emitir eventos
    req.app.get('io').emit('ingredient:restocked', {
      ingredient,
      movement: {
        quantity,
        reason: reason || 'Reposición manual'
      }
    });

    res.json({
      success: true,
      data: ingredient
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
});

// @route   POST /api/ingredients/:id/adjust
// @desc    Ajustar inventario
// @access  Private/Admin
router.post('/:id/adjust', protect, async (req, res) => {
  try {
    const { newStock, reason } = req.body;
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: 'Ingrediente no encontrado'
      });
    }

    const previousStock = ingredient.stock;
    const difference = newStock - previousStock;

    ingredient.stock = newStock;
    await ingredient.save();

    // Crear movimiento
    await InventoryMovement.create({
      type: 'adjustment',
      ingredient: ingredient._id,
      quantity: difference,
      previousStock,
      newStock,
      reason: reason || 'Ajuste manual',
      user: req.user._id
    });

    res.json({
      success: true,
      data: ingredient
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/ingredients/:id
// @desc    Eliminar ingrediente (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, async (req, res) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: 'Ingrediente no encontrado'
      });
    }

    ingredient.isActive = false;
    ingredient.lastModified = Date.now();
    ingredient.modifiedBy = req.user._id;
    await ingredient.save();

    req.app.get('io').emit('ingredient:deleted', { id: ingredient._id });

    res.json({
      success: true,
      message: 'Ingrediente eliminado',
      data: ingredient
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/ingredients/deduct
// @desc    Descontar ingredientes por receta
// @access  Private
router.post('/deduct', protect, async (req, res) => {
  const session = await Ingredient.startSession();
  session.startTransaction();

  try {
    const { recipeId, quantity, saleId } = req.body;
    const saleQuantity = Number(quantity);

    if (!recipeId || !saleQuantity || saleQuantity <= 0) {
      throw new Error('recipeId y quantity son obligatorios');
    }

    const recipe = await Recipe.findById(recipeId).session(session);
    if (!recipe) {
      throw new Error('Receta no encontrada');
    }

    const updatedIngredients = [];

    for (const recipeItem of recipe.items) {
      const ingredient = await Ingredient.findById(recipeItem.ingredientId).session(session);
      if (!ingredient) {
        throw new Error('Ingrediente no encontrado en receta');
      }

      const deductQty = recipeItem.quantity * saleQuantity;
      if (ingredient.stock < deductQty) {
        throw new Error(`Stock insuficiente para ${ingredient.name}`);
      }

      const previousStock = ingredient.stock;
      ingredient.stock -= deductQty;
      await ingredient.save({ session });

      await InventoryMovement.create([{
        type: 'recipe_deduction',
        ingredient: ingredient._id,
        quantity: -deductQty,
        previousStock,
        newStock: ingredient.stock,
        reason: saleId ? `Venta: ${saleId}` : 'Deducción por receta',
        user: req.user._id
      }], { session });

      updatedIngredients.push(ingredient);
    }

    await session.commitTransaction();

    req.app.get('io').emit('inventory:updated', updatedIngredients);

    res.json({
      success: true,
      ingredients: updatedIngredients
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
});

module.exports = router;
