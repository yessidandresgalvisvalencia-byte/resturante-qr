#!/usr/bin/env bash
set -euo pipefail
# Preflight de SOLO LECTURA: no merge, reset, checkout, push ni despliegue.
EXPECTED_MAIN="e967a8a30c8ed9a6df2ee2d1b536672c8aea860f"
EXPECTED_PERSONAL="142ef903677aa4891916944df70a0bf38e5dcb61"
git rev-parse --is-inside-work-tree >/dev/null
git fetch --no-tags origin \
  +refs/heads/main:refs/remotes/origin/main \
  +refs/heads/feature/finanzas-personales:refs/remotes/origin/feature/finanzas-personales
main=$(git rev-parse origin/main)
personal=$(git rev-parse origin/feature/finanzas-personales)
printf 'MAIN_ACTUAL=%s\nPERSONAL_ACTUAL=%s\n' "$main" "$personal"
if [[ "$main" != "$EXPECTED_MAIN" || "$personal" != "$EXPECTED_PERSONAL" ]]; then
  echo "BLOQUEADO: un origen avanzó; preparar un candidato nuevo y repetir pruebas." >&2
  exit 3
fi
set +e
git merge-tree --write-tree --name-only --messages "$main" "$personal"
resultado=$?
set -e
case "$resultado" in
  0) echo "SIN_CONFLICTOS_GIT: aún se requieren revisiones y todas las pruebas de ambos productos." ;;
  1) echo "BLOQUEADO: conflictos reales; prohibido fusionar a main o declarar integración completa." >&2; exit 1 ;;
  *) echo "ERROR_DIAGNOSTICO_GIT=$resultado" >&2; exit "$resultado" ;;
esac
