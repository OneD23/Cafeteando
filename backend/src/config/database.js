const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Atlas Conectado: ${conn.connection.host}`);
    
    // Eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error(`❌ Error de MongoDB: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB Desconectado');
    });

  } catch (error) {
    console.error(`❌ Error de conexión: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;