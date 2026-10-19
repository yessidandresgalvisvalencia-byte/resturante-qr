#!/usr/bin/env bash
set -uo pipefail

# Diagnóstico de solo lectura. Nunca usar git merge, reset, push ni checkout main.
# Requiere git >= 2.38 para git merge-tree --write-tree.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: no es un repositorio Git" >&2
  exit 2
fi
if ! git cat-file -e "refs/remotes/origin/main^{commit}" 2>/dev/null; then
  echo "ERROR: referencia origin/main no disponible; ejecutar git fetch origin main" >&2
  exit 2
fi

if ! git cat-file -e "refs/remotes/origin/feature/finanzas-personales^{commit}" 2>/dev/null; then
  echo "ERROR: referencia personal no disponible; ejecutar git fetch origin feature/finanzas-personales" >&2
  exit 2
fi

# En CI, la referencia remota puede avanzar mientras el job está en cola.
# No certificar una versión distinta del commit que inició el workflow.
if [ -n "${GRUK_EXPECTED_HEAD_SHA:-}" ]; then
  actual=$(git rev-parse origin/feature/finanzas-personales)
  if [ "$actual" != "$GRUK_EXPECTED_HEAD_SHA" ]; then
    echo "DIAGNOSTICO_OBSOLETO: la rama personal avanzó desde el SHA del workflow" >&2
    echo "Esperado: $GRUK_EXPECTED_HEAD_SHA" >&2
    echo "Actual: $actual" >&2
    exit 3
  fi
fi

echo "GRUK FP: diagnóstico de fusión de solo lectura"
echo "Rama actual: $(git rev-parse --abbrev-ref HEAD)"
echo "Head de la rama personal: $(git rev-parse origin/feature/finanzas-personales)"
echo "Base: $(git rev-parse origin/main)"

set +e
result=$(git merge-tree --write-tree --name-only --messages origin/main origin/feature/finanzas-personales 2>&1)
status=$?
set -e
printf '%s\n' "$result"
if [ "$status" -eq 0 ]; then
  echo "SIN_CONFLICTOS_DE_FUSION"
elif [ "$status" -eq 1 ]; then
  echo "CONFLICTOS_DE_FUSION_DETECTADOS: revisar las rutas enumeradas arriba antes de fusionar"
  echo "PLAN_SEGURO: no fusionar directamente ni sobrescribir archivos compartidos"
  echo "CI_YAML: conservar controles de main y pruebas exclusivas de Finanzas Personales"
  echo "APP_JS: mantener montaje y rutas empresariales; aislar el módulo personal y Socket.IO"
  echo "PACKAGE_JSON: unir scripts y dependencias; regenerar package-lock.json con npm install --package-lock-only"
  echo "LOCKFILE: no escoger unilateralmente un lockfile; exigir npm ci y ambos gates"
  echo "VALIDACION: ejecutar pruebas de ambos productos antes de cualquier integracion a main"
  echo "RUTA_GUIA: docs/finanzas-personales/integracion-segura-main.md"
  exit 1
else
  echo "ERROR_DIAGNOSTICO_MERGE_TREE"
  exit "$status"
fi
# Si no hay conflictos, la integración es viable desde la perspectiva de Git.
exit 0
