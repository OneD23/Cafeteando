const express = require('express');
const Ingredient = require('../models/Ingredient');
const InventoryMovement = require('../models/InventoryMovement');
const Recipe = require('../models/Recipe');
const { protect } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/audit');
const { expandIngredientRequirements, calculateCompositeUnitCost, roundQuantity } = require('../utils/ingredientComposition');

const router = express.Router();

const loadIngredientById = (session = null) => async (id) => {
  const query = Ingredient.findById(id);
  return session ? query.session(session) : query;
};

const assertValidComponents = (ingredientId, components = []) => {
  if (!Array.isArray(components)) return;
  const seen = new Set();
  components.forEach((component) => {
    const componentId = String(component.ingredientId || '');
    if (!componentId) throw new Error('Cada componente debe indicar ingredientId');
    if (ingredientId && componentId === String(ingredientId)) throw new Error('Un ingrediente no puede componerse de sí mismo');
    if (seen.has(componentId)) throw new Error('No repitas el mismo ingrediente componente');
    seen.add(componentId);
    if (!Number.isFinite(Number(component.quantity)) || Number(component.quantity) <= 0) {
      throw new Error('La cantidad de cada componente debe ser mayor a 0');
    }
  });
};

// @route   GET /api/ingredients
// @desc    Obtener todos los ingredientes
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const ingredients = await Ingredient.find({ isActive: true })
      .populate('components.ingredientId', 'name unit stock warehouseStock costPerUnit isActive')
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
    assertValidComponents(null, req.body.components);
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
    assertValidComponents(req.params.id, req.body.components);
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
    await logAuditEvent({ req, module: 'inventory', action: 'ingredient.updated', metadata: { ingredientId: ingredient._id, componentCount: ingredient.components?.length || 0 } });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/ingredients/:id/composition
// @desc    Obtener composición expandida de un ingrediente
// @access  Private
router.get('/:id/composition', protect, async (req, res) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id).populate('components.ingredientId', 'name unit stock warehouseStock costPerUnit isActive');
    if (!ingredient) return res.status(404).json({ success: false, message: 'Ingrediente no encontrado' });
    const unitCost = await calculateCompositeUnitCost(ingredient, { loadIngredient: loadIngredientById() });
    const expansion = await expandIngredientRequirements(ingredient.components || [], { loadIngredient: loadIngredientById(), path: [String(ingredient._id)] });
    res.json({ success: true, data: { ingredient, unitCost, requirements: expansion.requirements, details: expansion.details } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   POST /api/ingredients/:id/produce
// @desc    Producir un ingrediente compuesto consumiendo sus componentes
// @access  Private
router.post('/:id/produce', protect, async (req, res) => {
  const session = await Ingredient.startSession();
  session.startTransaction();
  try {
    const quantity = Number(req.body?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('quantity debe ser mayor a 0');
    const ingredient = await Ingredient.findById(req.params.id).session(session);
    if (!ingredient) throw new Error('Ingrediente no encontrado');
    if (!ingredient.components?.length) throw new Error('Solo se puede producir un ingrediente compuesto');

    const { requirements } = await expandIngredientRequirements(ingredient.components, { loadIngredient: loadIngredientById(session), path: [String(ingredient._id)] });
    for (const row of requirements) {
      const needed = roundQuantity(row.quantity * quantity);
      if (row.ingredient.stock < needed) throw new Error(`Stock insuficiente para ${row.ingredient.name}`);
    }

    const updatedIngredients = [];
    for (const row of requirements) {
      const component = await Ingredient.findById(row.ingredient._id).session(session);
      const needed = roundQuantity(row.quantity * quantity);
      const previousStock = component.stock;
      component.stock = roundQuantity(component.stock - needed);
      await component.save({ session });
      await InventoryMovement.create([{ type: 'component_consumption', ingredient: component._id, quantity: -needed, previousStock, newStock: component.stock, reason: `Producción de ${ingredient.name}`, user: req.user._id }], { session, ordered: true });
      updatedIngredients.push(component);
    }

    const previousStock = ingredient.stock;
    ingredient.stock = roundQuantity(ingredient.stock + quantity);
    ingredient.costPerUnit = await calculateCompositeUnitCost(ingredient, { loadIngredient: loadIngredientById(session) });
    ingredient.lastRestocked = new Date();
    await ingredient.save({ session });
    await InventoryMovement.create([{ type: 'production', ingredient: ingredient._id, quantity, previousStock, newStock: ingredient.stock, reason: req.body?.reason || `Producción de ${ingredient.name}`, user: req.user._id }], { session, ordered: true });
    updatedIngredients.push(ingredient);

    await session.commitTransaction();
    req.app.get('io').emit('inventory:updated', updatedIngredients);
    res.json({ success: true, data: ingredient, components: updatedIngredients });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

// @route   POST /api/ingredients/:id/restock
// @desc    Reponer stock
// @access  Private
router.post('/:id/restock', protect, async (req, res) => {
  const session = await Ingredient.startSession();
  session.startTransaction();

  try {
    const { quantity, reason, location = 'warehouse' } = req.body;
    const ingredient = await Ingredient.findById(req.params.id).session(session);

    if (!ingredient) {
      throw new Error('Ingrediente no encontrado');
    }

    const targetLocation = location === 'greca' ? 'greca' : 'warehouse';
    const previousStock = ingredient.stock;
    const previousWarehouseStock = ingredient.warehouseStock || 0;
    if (targetLocation === 'greca') {
      ingredient.stock = roundQuantity(ingredient.stock + quantity);
    } else {
      ingredient.warehouseStock = roundQuantity((ingredient.warehouseStock || 0) + quantity);
    }
    ingredient.lastRestocked = new Date();
    await ingredient.save({ session });

    // Crear movimiento
    await InventoryMovement.create([{
      type: 'restock',
      ingredient: ingredient._id,
      quantity,
      previousStock,
      newStock: ingredient.stock,
      location: targetLocation,
      previousWarehouseStock,
      newWarehouseStock: ingredient.warehouseStock || 0,
      reason: reason || (targetLocation === 'warehouse' ? 'Reposición a almacén' : 'Reposición a greca'),
      user: req.user._id
    }], { session, ordered: true });

    await session.commitTransaction();

    // Emitir eventos
    req.app.get('io').emit('ingredient:restocked', {
      ingredient,
      movement: {
        quantity,
        reason: reason || (targetLocation === 'warehouse' ? 'Reposición a almacén' : 'Reposición a greca')
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


// @route   POST /api/ingredients/:id/transfer
// @desc    Transferir stock entre almacén y greca
// @access  Private
router.post('/:id/transfer', protect, async (req, res) => {
  const session = await Ingredient.startSession();
  session.startTransaction();

  try {
    const quantity = Number(req.body?.quantity);
    const direction = req.body?.direction === 'to_warehouse' ? 'to_warehouse' : 'to_greca';
    const reason = req.body?.reason;

    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('quantity debe ser mayor a 0');

    const ingredient = await Ingredient.findById(req.params.id).session(session);
    if (!ingredient) throw new Error('Ingrediente no encontrado');

    const previousStock = ingredient.stock;
    const previousWarehouseStock = ingredient.warehouseStock || 0;

    if (direction === 'to_greca') {
      if (previousWarehouseStock < quantity) throw new Error(`Stock insuficiente en almacén para ${ingredient.name}`);
      ingredient.warehouseStock = roundQuantity(previousWarehouseStock - quantity);
      ingredient.stock = roundQuantity(previousStock + quantity);
    } else {
      if (previousStock < quantity) throw new Error(`Stock insuficiente en greca para ${ingredient.name}`);
      ingredient.stock = roundQuantity(previousStock - quantity);
      ingredient.warehouseStock = roundQuantity(previousWarehouseStock + quantity);
    }

    await ingredient.save({ session });
    await InventoryMovement.create([{
      type: direction === 'to_greca' ? 'transfer_to_greca' : 'transfer_to_warehouse',
      ingredient: ingredient._id,
      quantity,
      previousStock,
      newStock: ingredient.stock,
      location: direction === 'to_greca' ? 'greca' : 'warehouse',
      previousWarehouseStock,
      newWarehouseStock: ingredient.warehouseStock,
      reason: reason || (direction === 'to_greca' ? 'Traslado de almacén a greca' : 'Devolución de greca a almacén'),
      user: req.user._id
    }], { session, ordered: true });

    await session.commitTransaction();
    req.app.get('io').emit('inventory:updated', [ingredient]);
    res.json({ success: true, data: ingredient });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
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

    const { requirements } = await expandIngredientRequirements(recipe.items, { loadIngredient: loadIngredientById(session) });

    for (const row of requirements) {
      const ingredient = await Ingredient.findById(row.ingredient._id).session(session);
      if (!ingredient) {
        throw new Error('Ingrediente no encontrado en receta');
      }

      const deductQty = roundQuantity(row.quantity * saleQuantity);
      if (ingredient.stock < deductQty) {
        throw new Error(`Stock insuficiente para ${ingredient.name}`);
      }

      const previousStock = ingredient.stock;
      ingredient.stock = roundQuantity(ingredient.stock - deductQty);
      await ingredient.save({ session });

      await InventoryMovement.create([{
        type: 'recipe_deduction',
        ingredient: ingredient._id,
        quantity: -deductQty,
        previousStock,
        newStock: ingredient.stock,
        reason: saleId ? `Venta: ${saleId}` : 'Deducción por receta',
        user: req.user._id
      }], { session, ordered: true });

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
