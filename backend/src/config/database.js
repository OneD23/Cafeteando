const mongoose = require('mongoose');

let isConnecting = false;

const connectDB = async () => {
  if (isConnecting || mongoose.connection.readyState === 1) {
    return;
  }

  try {
    isConnecting = true;

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 1),
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
      heartbeatFrequencyMS: Number(process.env.MONGO_HEARTBEAT_FREQUENCY_MS || 10000),
      retryWrites: true,
    });

    console.log(`✅ MongoDB Atlas Conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error de conexión a MongoDB: ${error.message}`);

    // Reintento simple con backoff fijo para no tumbar la API.
    setTimeout(() => {
      connectDB().catch(() => {});
    }, Number(process.env.MONGO_RETRY_DELAY_MS || 5000));
  } finally {
    isConnecting = false;
  }
};

mongoose.connection.on('connected', () => {
  console.log('🟢 MongoDB conectado');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ Error de MongoDB: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB desconectado. Reintentando conexión...');
  setTimeout(() => {
    connectDB().catch(() => {});
  }, Number(process.env.MONGO_RETRY_DELAY_MS || 5000));
});

module.exports = connectDB;
