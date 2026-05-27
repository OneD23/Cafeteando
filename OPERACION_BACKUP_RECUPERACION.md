# Backup, restauración y rollback

## Backup MongoDB
1. Ejecutar:
```bash
mongodump --uri="$MONGODB_URI" --out="./backups/$(date +%F_%H%M%S)"
```
2. Comprimir y almacenar fuera del servidor.

## Restauración MongoDB
```bash
mongorestore --uri="$MONGODB_URI" --drop ./backups/<timestamp>/cafetrack
```

## Rollback de versión de aplicación
1. Identificar commit/tag estable previo.
2. Desplegar imagen/artefacto del commit estable.
3. Restaurar DB solo si hubo migraciones incompatibles.
4. Validar endpoints críticos: `/health`, `/api/auth/login`, `/api/sales`.

## Política recomendada
- Backup diario + retención 30 días.
- Simulacro de restauración mensual.
