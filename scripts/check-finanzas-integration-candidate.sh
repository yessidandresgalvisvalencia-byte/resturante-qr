#!/usr/bin/env bash
set -euo pipefail
# Diagnóstico sin mutaciones. NO ejecuta merge, checkout, reset ni push.
EXPECTED_MAIN="66194960e0b5b2c02ffdea06cfa369db0d218da8"
EXPECTED_PERSONAL="142ef903677aa4891916944df70a0bf38e5dcb61"
git rev-parse --is-inside-work-tree >/dev/null
git fetch --no-tags origin \
  +refs/heads/main:refs/remotes/origin/main \
  +refs/heads/feature/finanzas-personales:refs/remotes/origin/feature/finanzas-personales
actual_main=$(git rev-parse origin/main)
actual_personal=$(git rev-parse origin/feature/finanzas-personales)
printf 'main=%s\npersonal=%s\n' "$actual_main" "$actual_personal"
if [[ "$actual_main" != "$EXPECTED_MAIN" || "$actual_personal" != "$EXPECTED_PERSONAL" ]]; then
  echo "BASE_OBSOLETA: revisar la divergencia antes de proponer resolucion" >&2
  exit 3
fi
set +e
git merge-tree --write-tree --name-only --messages origin/main origin/feature/finanzas-personales
status=$?
set -e
if [[ "$status" -eq 1 ]]; then
  echo "FUSION_BLOQUEADA: conflictos reales. NO aplicar merge a main." >&2
  exit 1
fi
if [[ "$status" -ne 0 ]]; then
  echo "FALLO_DIAGNOSTICO" >&2
  exit "$status"
fi
echo "SIN_CONFLICTOS: no implica seguridad de integrar; faltan pruebas duales."
