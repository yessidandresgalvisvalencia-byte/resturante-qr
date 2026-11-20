# GRUK Empresarial — bloqueo de dependencias y publicación (2026-11-02)

## Alcance y procedencia
Este registro corresponde al control de calidad P1-75 del plan maestro oficial (criterio: cada actualización puede probarse y revertirse). No constituye evidencia de aprobación ni sustituye los resultados de GitHub Actions.

## Bloqueos conocidos
- El workflow `.github/workflows/ci.yml` ejecuta `npm ci`, seguido de `npm audit --omit=dev --audit-level=high`, antes de las pruebas de sintaxis y unitarias.
- Ejecuciones previas comunicaron vulnerabilidades altas en `follow-redirects` (GHSA-mrwp-f3q8-3g9p) y `joi` (GHSA-4528-x5fx-h6hg). **Volver a verificar contra el lockfile y el registro actual**; no asumir que continúan presentes ni que están resueltas.
- Los servicios Render `resturante-qr-1` y `resturante-qr` se observaron anteriormente con despliegue automático desde `main`. Revalidar antes de cualquier fusión. No fusionar mientras una fusión pueda publicar prematuramente.
- La consulta de workflows del commit abreviado `829110ca` devolvió `workflow_runs: []` el 2026-11-02. La ausencia de resultados **no** equivale a éxito o fallo y la consulta solo cubre ciertos eventos.

## Plan de remediación verificable
1. Inspeccionar `package-lock.json` y el árbol `npm ls follow-redirects joi` para identificar rutas transitivas y versiones exactas.
2. Actualizar dependencias directas o transitivas con una resolución compatible y regenerar lockfile con la versión de Node/npm fijada por CI. No silenciar `npm audit` ni ignorar alertas altas.
3. Ejecutar `npm ci`, `npm audit --omit=dev --audit-level=high`, `npm run gate` y pruebas de integración de pagos, validación de entrada y límites multiempresa; conservar enlaces a los jobs de CI para el SHA exacto.
4. Inspeccionar diff para excluir `modules/finanzas-personales/`, `public/finanzas-personales.*` y cualquier ruta de Blushéa.
5. Solo tras verificar controles verdes, aislamiento, respaldo y rollback, revisar la posibilidad de integración. El despliegue de producción requiere **además** los 77 criterios completos, E2E y revisión de seguridad.

## Trazabilidad
| Requisito | Estado | Código / configuración | Pruebas y evidencia |
|---|---|---|---|
| 75 P1 — Gobierno de cambios | BLOQUEADO | `.github/workflows/ci.yml`, `package.json`, `package-lock.json` | Auditoría de dependencias pendiente de corrección y ejecución verde en SHA final |
| 70 P0 — Aislamiento multiempresa | PARCIAL | PR #524 y #534 pendientes de integración | No hay certificación E2E completa entre empresas y sedes |

**No marcar ningún requisito VERIFICADO basándose únicamente en este documento.**
