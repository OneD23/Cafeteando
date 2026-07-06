const express = require('express');
const Product = require('../models/Product');
const Recipe = require('../models/Recipe');
const { protect } = require('../middleware/auth');
const { logAuditEvent } = require('../utils/audit');

const router = express.Router();

// @route   GET /api/products
// @desc    Obtener todos los productos con sus recetas
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .populate('recipeId')
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/products
// @desc    Crear producto con receta
// @access  Private/Admin/Manager
router.post('/', protect, async (req, res) => {
  const session = await Product.startSession();
  session.startTransaction();

  try {
    const { name, price, category, icon, image, recipe, sku, options } = req.body;
    if (sku) {
      const dup = await Product.findOne({ sku: String(sku).toUpperCase().trim() }).session(session);
      if (dup) throw new Error('SKU duplicado');
    }

    // Crear producto
    const product = await Product.create([{
      name,
      price,
      category,
      icon: icon || '☕',
      image,
      sku,
      options: Array.isArray(options) ? options : [],
      hasRecipe: true
    }], { session, ordered: true });

    // Crear receta
    const newRecipe = await Recipe.create([{
      productId: product[0]._id,
      items: recipe.items,
      preparationTime: recipe.preparationTime || 2,
      instructions: recipe.instructions,
      image: recipe.image
    }], { session, ordered: true });

    // Actualizar producto con referencia a receta
    product[0].recipeId = newRecipe[0]._id;
    await product[0].save({ session });

    await session.commitTransaction();

    // Populate y emitir
    const populatedProduct = await Product.findById(product[0]._id)
      .populate('recipeId');

    req.app.get('io').emit('product:created', populatedProduct);

    res.status(201).json({
      success: true,
      data: populatedProduct
    });
    await logAuditEvent({ req, module: 'products', action: 'product.created', metadata: { productId: populatedProduct._id, sku: populatedProduct.sku || null } });

  } catch (error) {
    await session.abortTransaction();
    await logAuditEvent({ req, module: 'products', action: 'product.create_failed', outcome: 'failure', metadata: { error: error.message } });
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
});

// @route   PUT /api/products/:id
// @desc    Actualizar producto
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const session = await Product.startSession();
  session.startTransaction();

  try {
    const { recipe, ...productUpdates } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      productUpdates,
      { new: true, runValidators: true, session }
    );

    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    if (recipe) {
      const recipeUpdates = {
        ...recipe,
        productId: product._id,
        lastModified: new Date()
      };

      let updatedRecipe = null;
      if (product.recipeId) {
        updatedRecipe = await Recipe.findByIdAndUpdate(
          product.recipeId,
          recipeUpdates,
          { new: true, runValidators: true, session }
        );
      }

      if (!updatedRecipe) {
        updatedRecipe = await Recipe.findOneAndUpdate(
          { productId: product._id },
          recipeUpdates,
          { new: true, upsert: true, runValidators: true, session }
        );
      }

      product.recipeId = updatedRecipe._id;
      product.hasRecipe = true;
      await product.save({ session });
    }

    await session.commitTransaction();

    const populatedProduct = await Product.findById(product._id).populate('recipeId');

    req.app.get('io').emit('product:updated', populatedProduct);

    res.json({
      success: true,
      data: populatedProduct
    });
    await logAuditEvent({ req, module: 'products', action: 'product.updated', metadata: { productId: populatedProduct._id } });
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

// @route   DELETE /api/products/:id
// @desc    Eliminar producto y su receta
// @access  Private/Admin
router.delete('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Soft delete
    product.isActive = false;
    await product.save();

    // Desactivar receta también
    await Recipe.findByIdAndUpdate(product.recipeId, { isActive: false });

    req.app.get('io').emit('product:deleted', { id: req.params.id });

    res.json({
      success: true,
      message: 'Producto eliminado'
    });
    await logAuditEvent({ req, module: 'products', action: 'product.deleted', metadata: { productId: product._id } });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
