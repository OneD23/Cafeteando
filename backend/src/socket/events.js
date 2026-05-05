module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);

    // Unirse a sala de tienda (para multi-sucursal futuro)
    socket.on('join-store', (storeId) => {
      socket.join(`store-${storeId}`);
      console.log(`Cliente ${socket.id} unido a tienda ${storeId}`);
    });

    // Sincronización de datos offline
    socket.on('sync:request', async (data) => {
      // Enviar datos actualizados al cliente
      const Ingredient = require('../models/Ingredient');
      const Product = require('../models/Product');
      
      const ingredients = await Ingredient.find({ isActive: true });
      const products = await Product.find({ isActive: true }).populate('recipeId');
      
      socket.emit('sync:complete', {
        timestamp: new Date(),
        ingredients,
        products
      });
    });

    // Venta en tiempo real
    socket.on('sale:live', (data) => {
      socket.to(`store-${data.storeId}`).emit('sale:notification', data);
    });

    socket.on('disconnect', () => {
      console.log('❌ Cliente desconectado:', socket.id);
    });
  });
};