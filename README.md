# Cafeteando

Monorepo con dos componentes principales:

- `backend/`: API REST + Socket.io + MongoDB.
- `cafetrack-mobile/`: aplicación Expo/React Native para POS.

## Requisitos

- Node.js 18+
- npm 9+
- MongoDB (Atlas o local)

## Inicio rápido

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Variables esperadas en `backend/.env`:

- `PORT=5000`
- `MONGODB_URI=...`
- `JWT_SECRET=...`
- `JWT_EXPIRE=7d`
- `CLIENT_URL=http://localhost:8081` (opcional)
- `CLIENT_URLS=http://localhost:19006,http://localhost:3000` (opcional)

### 2) Mobile

```bash
cd cafetrack-mobile
npm install
npm run start
```

## Scripts útiles

### Backend

- `npm run dev`: arranque en desarrollo con nodemon.
- `npm run start`: arranque productivo.

### Mobile

- `npm run ts:check`: validación TypeScript.
- `npm run check:screens`: validación de integridad de pantallas.

## Recomendaciones operativas

- No versionar `node_modules`.
- Ejecutar checks (`ts:check`, `check:screens`) antes de commit.
- Mantener `JWT_SECRET` y `MONGODB_URI` fuera del repositorio.
