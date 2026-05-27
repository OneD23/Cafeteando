# Migraciones e índices (v1)

## Índices agregados
- `users.email` (ya cubierto por `unique: true` en schema).
- `products.sku` único/sparse.
- `sales.createdAt` descendente (consultas por fecha).
- `sales.saleId` único/sparse (número de factura interno).
- `sales.customer.phone` y `sales.customer.cedula` para búsquedas de clientes embebidos.

## Script sugerido (Mongo Shell)
```javascript
use cafetrack;
db.products.createIndex({ sku: 1 }, { unique: true, sparse: true });
db.sales.createIndex({ createdAt: -1 });
db.sales.createIndex({ saleId: 1 }, { unique: true, sparse: true });
db.sales.createIndex({ 'customer.phone': 1 });
db.sales.createIndex({ 'customer.cedula': 1 });
```

## Verificación de duplicados antes de migrar
```javascript
db.products.aggregate([{ $match: { sku: { $ne: null } } }, { $group: { _id: '$sku', c: { $sum: 1 } } }, { $match: { c: { $gt: 1 } } }]);
db.sales.aggregate([{ $group: { _id: '$saleId', c: { $sum: 1 } } }, { $match: { c: { $gt: 1 } } }]);
```
