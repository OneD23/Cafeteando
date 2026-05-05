#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ Este script debe ejecutarse dentro de un repo git."
  exit 1
fi

if [[ -z "$BRANCH" ]]; then
  echo "Uso: ./scripts/git/sync_branch.sh <rama>"
  exit 1
fi

echo "➡️  Cambiando a rama: $BRANCH"
git checkout "$BRANCH"

echo "➡️  Trayendo cambios remotos"
git fetch origin

echo "➡️  Rebaseando sobre origin/main"
git rebase origin/main

echo "➡️  Ejecutando chequeo TypeScript"
npm --prefix cafetrack-mobile run ts:check

echo "✅ Listo. Puedes subir con: git push --force-with-lease"
