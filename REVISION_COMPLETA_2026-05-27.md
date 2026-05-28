# Revisión completa del proyecto Cafeteando (27 mayo 2026)

## Alcance

Esta revisión cubre el monorepo completo:

- `backend/` (API Express + MongoDB + Socket.io)
- `cafetrack-mobile/` (Expo/React Native + Redux)
- documentación y operativa de desarrollo

Incluye análisis de funcionalidad, persistencia de datos, seguridad, modernización técnica, calidad, DX/DevOps y plan de mejora.

---

## 1) Estado general (resumen ejecutivo)

El sistema está **funcional como MVP productivo temprano**, con piezas clave implementadas:

- autenticación JWT,
- dominio POS/inventario/ventas,
- sincronización offline básica en mobile,
- endurecimientos iniciales (helmet, rate-limit, CORS por lista).

Sin embargo, aún presenta deuda relevante en:

1. **Confiabilidad de persistencia offline** (cola local sin reintentos robustos ni idempotencia).
2. **Seguridad aplicada por endpoint** (validaciones incompletas de input, exposición de errores en algunas rutas).
3. **Calidad y mantenibilidad** (sin tests automáticos ni pipeline CI).
4. **Modernización de plataforma** (falta estandarizar toolchain de lint/test/build y observabilidad).

---

## 2) Funcionalidad (backend + app)

### Fortalezas

- Separación funcional clara por módulos (auth, ingredientes, productos, ventas, clientes, fiscal).
- Flujo de sesión en app correctamente condicionado por `auth.user`.
- Hidratación inicial de estado y carga de catálogos al iniciar sesión.

### Hallazgos

- El backend no muestra una capa de validación sistemática en todos los endpoints (p.ej. esquema por ruta), lo que aumenta riesgo de datos inconsistentes y errores de ejecución.
- Existe lógica de “bootstrap admin” correcta para primer arranque, pero requiere gobernanza operativa explícita para no dejar exposición innecesaria.
- En mobile, `restoreSession` ignora errores (`catch {}`), lo cual evita crashes pero oculta problemas de token/API.

### Recomendaciones

- Introducir validación de payload por endpoint (Joi/Zod/express-validator homogéneo).
- Estandarizar respuestas de error (`code`, `message`, `details`, `traceId`).
- Añadir manejo de errores observable en mobile (telemetría + UI no intrusiva).

---

## 3) Persistencia y consistencia de datos

### Backend (MongoDB)

- Hay reconexión automática en `database.js`, buen punto de partida.
- Faltan garantías adicionales para operaciones críticas (ventas/inventario): transacciones cuando aplique, idempotencia y controles de concurrencia.

### Mobile (offline queue)

- Se usa AsyncStorage como cola (`sync_queue_v1`) con marca `synced`.
- El proceso de sync es secuencial y corta al primer error (correcto para backpressure), pero:
  - no hay límite/reintentos por item,
  - no hay deduplicación,
  - no hay idempotency key hacia backend,
  - no hay política de expiración/compactación.

### Recomendaciones

1. Agregar `idempotencyKey` por operación offline y soporte en backend.
2. Implementar reintentos con backoff exponencial + contador máximo.
3. Persistir `lastError`/`retryCount` por item para diagnósticos.
4. Definir estrategia de “dead-letter queue” para elementos imposibles de sincronizar.

---

## 4) Seguridad

### Positivo

- `helmet`, `compression`, `rate-limit`, CORS controlado.
- Middleware JWT y restricción por rol existentes.

### Riesgos

- Posible filtrado de mensajes internos en respuestas de error en ciertas rutas (`error.message` directo).
- Sin evidencia de validación exhaustiva de entrada en todos los endpoints.
- Falta de checklist de hardening operativo (rotación JWT secret, política de contraseñas, bloqueo por intentos fallidos).

### Recomendaciones

- Uniformar manejo de errores sin exponer detalles internos al cliente.
- Añadir validación/normalización estricta de entrada en todas las rutas.
- Introducir políticas de seguridad de credenciales y auditoría de accesos.

---

## 5) Modernización técnica

### Estado actual

- Stack moderno en mobile (React 19, RN 0.81, Expo 54).
- Backend funcional pero sin capa de calidad automatizada (tests/lint/CI).

### Brechas

- Ausencia de scripts `test` y `lint` en backend/mobile.
- No hay pipeline CI para asegurar regresiones.
- No hay estrategia de versionado/entrega documentada (release process).

### Recomendaciones

- Adoptar estándares mínimos:
  - Backend: ESLint + tests de integración (Jest + Supertest).
  - Mobile: ESLint + pruebas unitarias de slices/hooks críticos.
- Configurar CI (GitHub Actions) con etapas: install, lint, test, typecheck.
- Añadir convenciones de commit/release (Changesets o semantic-release).

---

## 6) Observabilidad y operación

### Hallazgos

- Existe `/health` básico y logs por consola.
- Falta trazabilidad operativa: métricas, correlación de requests, alertas.

### Recomendaciones

- Estructurar logs JSON con `requestId`.
- Extender healthcheck con dependencias (DB/socket) y latencia.
- Integrar monitoreo básico (Sentry/Datadog/OpenTelemetry).

---

## 7) Plan de trabajo priorizado (30/60/90)

### 0-30 días (alto impacto)

1. Agregar `lint` y `test` en ambos paquetes.
2. Establecer CI mínimo bloqueante para PRs.
3. Normalizar errores API y validación de inputs.
4. Definir hardening de bootstrap admin y secretos.

### 31-60 días

1. Implementar idempotencia y reintentos de cola offline.
2. Pruebas de integración para auth, ventas e inventario.
3. Métricas básicas + logging estructurado.

### 61-90 días

1. Fortalecer transacciones de dominio crítico.
2. Observabilidad completa y alarmas.
3. Proceso formal de release y rollback.

---

## 8) Scorecard (actual)

- Funcionalidad de negocio: **7/10**
- Persistencia/consistencia: **5/10**
- Seguridad aplicada: **6/10**
- Modernización/arquitectura técnica: **6/10**
- Calidad automatizada (tests/CI): **3/10**
- Operación/observabilidad: **4/10**

**Resultado global estimado: 5.2/10** (MVP útil, requiere endurecimiento para escalar con riesgo controlado).

---

## 9) Conclusión

Cafeteando tiene una base sólida para seguir creciendo, pero necesita una fase clara de **estabilización técnica** enfocada en pruebas, confiabilidad offline, seguridad por defecto y observabilidad. Si se ejecuta el plan 30/60/90, el proyecto puede pasar de MVP funcional a plataforma operable con mejor resiliencia y menor costo de mantenimiento.
