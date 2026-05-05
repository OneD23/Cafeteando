const express = require('express');
const Product = require('../models/Product');
const Recipe = require('../models/Recipe');
const { protect } = require('../middleware/auth');

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
    const { name, price, category, icon, image, recipe } = req.body;

    // Crear producto
    const product = await Product.create([{
      name,
      price,
      category,
      icon: icon || '☕',
      image,
      hasRecipe: true
    }], { session });

    // Crear receta
    const newRecipe = await Recipe.create([{
      productId: product[0]._id,
      items: recipe.items,
      preparationTime: recipe.preparationTime || 2,
      instructions: recipe.instructions,
      image: recipe.image
    }], { session });

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

// @route   PUT /api/products/:id
// @desc    Actualizar producto
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('recipeId');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    req.app.get('io').emit('product:updated', product);

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
