#!/usr/bin/env bash
set -uo pipefail

# Diagnóstico de solo lectura. Nunca usar git merge, reset, push ni checkout main.
# Requiere git >= 2.38 para git merge-tree --write-tree.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: no es un repositorio Git" >&2
  exit 2
fi
if ! git cat-file -e refs/remotes/origin/main^{commit} 2>/dev/null; then
  echo "ERROR: referencia origin/main no disponible; ejecutar git fetch origin main" >&2
  exit 2
fi

echo "GRUK FP: diagnóstico de fusión de solo lectura"
echo "Rama actual: $(git rev-parse --abbrev-ref HEAD)"
echo "Head: $(git rev-parse HEAD)"
echo "Base: $(git rev-parse origin/main)"

set +e
result=$(git merge-tree --write-tree --messages origin/main HEAD 2>&1)
status=$?
set -e
printf '%s\n' "$result"
if [ "$status" -eq 0 ]; then
  echo "SIN_CONFLICTOS_DE_TEXTO"
elif [ "$status" -eq 1 ]; then
  echo "CONFLICTOS_DE_FUSION_DETECTADOS"
else
  echo "ERROR_DIAGNOSTICO_MERGE_TREE"
  exit "$status"
fi
# El conflicto se registra como evidencia sin bloquear los demás tests.
exit 0
