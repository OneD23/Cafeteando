const mongoose = require('mongoose');

const uri = "mongodb+srv://OneD:2233@atlascluster.k3fvuvl.mongodb.net/cafetrack?retryWrites=true&w=majority";

mongoose.connect(uri)
  .then(() => {
    console.log('✅ CONECTADO a MongoDB Atlas');
    console.log('Base de datos:', mongoose.connection.name);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  });