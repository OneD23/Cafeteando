const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Generar JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @route   POST /api/auth/login
// @desc    Login usuario
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validar
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporciona usuario y contraseña'
      });
    }

    // Buscar usuario
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Usuario desactivado'
      });
    }

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Generar token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en login',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Obtener usuario actual
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/register
// @desc    Registrar usuario (solo admin)
// @access  Private/Admin
router.post('/register', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { username, email, password, name, role } = req.body;

    const user = await User.create({
      username,
      email,
      password,
      name,
      role: role || 'cashier'
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/bootstrap
// @desc    Crear primer usuario admin (solo si no existen usuarios)
// @access  Public (una sola vez)
router.post('/bootstrap', async (req, res) => {
  try {
    const usersCount = await User.countDocuments();

    if (usersCount > 0) {
      return res.status(403).json({
        success: false,
        message: 'Bootstrap deshabilitado: ya existen usuarios'
      });
    }

    const { username, email, password, name } = req.body;

    if (!username || !email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'username, email, password y name son obligatorios'
      });
    }

    const user = await User.create({
      username,
      email,
      password,
      name,
      role: 'admin'
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Usuario administrador inicial creado',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
