require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const connectDB = require('./src/config/database');
const socketEvents = require('./src/socket/events');

// Rutas
const authRoutes = require('./src/routes/auth');
const ingredientRoutes = require('./src/routes/ingredients');
const productRoutes = require('./src/routes/products');
const saleRoutes = require('./src/routes/sales');

// Conectar a MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

const defaultAllowedOrigins = [
  'http://localhost:8081', // Expo Web (actual)
  'http://localhost:19006', // Expo Web (legacy)
  'http://localhost:3000',
];

const envAllowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS ? process.env.CLIENT_URLS.split(',') : []),
]
  .map((origin) => origin?.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const corsOptions = {
  origin: (origin, callback) => {
    // Permite requests server-to-server o tools sin Origin.
    if (!origin) {
      return callback(null, true);
    }

    // En desarrollo permitimos cualquier localhost para evitar bloqueos de Expo/Web.
    if (process.env.NODE_ENV !== 'production' && /localhost|127\.0\.0\.1/.test(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = socketIo(server, {
  cors: corsOptions
});

// Hacer io disponible en rutas
app.set('io', io);

// Middleware de seguridad
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100
});
app.use('/api/', limiter);

// CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);

// Socket.io events
socketEvents(io);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
  🚀 CafeTrack API corriendo en puerto ${PORT}
  📊 MongoDB Atlas: Conectado
  🔌 Socket.io: Activo
  `);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});
