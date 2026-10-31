# P0-70 — Auditoría de lectura QR por mesa (30-10-2026)

**Fuente:** Plan Maestro 77, requisito 70. **Estado: PARCIAL, no certificado.**

## Evidencia inspeccionada en rama de integración #524

- `routes/API.js` GET `/pedidos/mesa/:mesa` (línea ~1509) y GET `/factura/mesa/:mesa` (~2241) llaman `resolveMesaQrRead` y usan `Pedido.find(scope.filter)`; ambas respuestas usan `Cache-Control: no-store` y una proyección de campos.
- `core/security/qrMesaRead.service.js` verifica HMAC-SHA256, firma con comparación temporal segura, expiración, empresa, restaurante, mesa y sede; vuelve a consultar restaurante/sede persistidos antes de permitir lectura.
- **Brecha original, corregida en este PR pero sin validación de integración:** la versión base de `resolveMesaQrRead` devolvía filtros con `restaurantId`, `mesa` y `sedeId`, **sin `empresaId`**. La rama del PR añade el filtro de empresa en ambos casos. La comprobación previa de `Restaurante` por empresa no demuestra por sí sola que cada `Pedido` leído pertenezca a esa empresa. Se necesita verificar invariantes de unicidad global de `restaurantId`, migración de pedidos históricos, y/o imponer empresa en consulta de forma compatible con datos legados. No marcar aislamiento de base de datos como verificado.
- **Riesgo adicional:** token de capacidad QR en parámetros de URL; comprobar redacción de logs, analítica, referer y política de redirección antes de producción. Caducidad actual: 90 días; falta estrategia operativa de revocación/reimpresión.
- **Evidencia aún ausente:** pruebas HTTP + MongoDB real de colisión de identificadores y sedes, migración de pedidos sin `empresaId`, navegador E2E, reimpresión de QR, Wompi, logs y observabilidad.

## Criterio de cierre de este hallazgo

1. Construir fixtures con dos empresas y restaurantes con identificadores en conflicto, pedidos históricos y sedes con alias.
2. Comprobar que un QR de A jamás lee pedidos de B, incluso cuando comparten mesa/sede o hay registros legados; denegar ambigüedad.
3. Aplicar filtro de empresa en consulta o demostrar por pruebas e índices una invariante equivalente y resistente a concurrencia.
4. Ejecutar pruebas de integración reales y guardar enlaces a checks; no fusionar a `main` mientras Render Auto-Deploy pueda publicar prematuramente.

**Resultado actualizado:** la rama de PR #534 contiene corrección funcional de filtros, pero únicamente evidencia de revisión estática y pruebas unitarias escritas; no hay certificación de aceptación. No autoriza despliegue.

## Corrección propuesta (30-10-2026)

- Commit `b07e434`: `resolveMesaQrRead` incluye `empresaId: p.e` en ambos filtros MongoDB (sede canónica/alias y mesa sin sede). Las rutas HTTP existentes usan `Pedido.find(scope.filter)`, por lo que pedidos de otras empresas y registros sin `empresaId` quedan excluidos (fail-closed).
- Commit `2e85b00`: pruebas unitarias del filtro, alias y denegación de restaurante ajeno en `test/gruk/p0-70-qr-read-enterprise-filter.test.js`.
- **No certificado:** faltan ejecución y resultados de CI, prueba HTTP+MongoDB real con colisiones, plan de migración de pedidos legados, QR en navegador, Wompi y auditoría de filtración de tokens. No desplegar.

## Revisión adicional de pruebas (30-10-2026)

- Commit `e9b9642`: dos casos adicionales verifican que la consulta de restaurante incluya `empresaId`, que la consulta de sede exija `_id`, `empresaId` y `restauranteId`, y que un registro inexistente se rechace sin entregar filtro de lectura.
- El conjunto actual es **unitario con modelos simulados**. La selección de registros en MongoDB, el comportamiento de las rutas HTTP, las colisiones de tenant y la migración legacy **no están certificados**. No atribuir a estas pruebas evidencia de integración real.
- Consulta de Actions para `8198f5f`: no se devolvieron ejecuciones asociadas; el commit posterior requiere una nueva comprobación. **Sin CI verde confirmado, no fusionar este PR.**

## Seguimiento de controles — 30-10-2026, 13:14 Colombia

- HEAD del PR #534: `8c42c8149d783aa4c0cf20babfb9d346fe96b688`, base rama de integración #524, estado draft abierto.
- Consulta directa de ejecuciones GitHub Actions asociadas al HEAD: `workflow_runs: []`. **Esto no demuestra que las pruebas aprobaron**; puede reflejar ausencia de ejecuciones o limitación de consulta para eventos PR.
- Decisión: mantener PR #534 abierto, sin fusionar a rama de integración ni `main`. P0-70 sigue PARCIAL; pendientes CI verificable, integración HTTP/MongoDB real con colisiones y legacy, E2E, migración y validación de seguridad.
- Riesgo operativo: Auto-Deploy de Render sobre `main` sigue documentado como bloqueo; no desplegar ni alterar los otros productos.

## Seguimiento adicional — 30-10-2026

- Commit `51068276`: dos regresiones negativas adicionales comprueban capacidades QR válidamente firmadas por empresa B contra restaurante y sede de A; ambos accesos deben denegarse sin devolver filtro de lectura. Son pruebas unitarias con dobles de modelo, **no** demuestran aislamiento HTTP/MongoDB real.
- Cobertura actual: filtro explícito de empresa en ambas ramas de lectura, denegación de restaurante/sede inexistentes y de capacidades firmadas para otro tenant. Pendiente: ejecutar los tests y verificar CI del HEAD actualizado, integración real con colisiones y legacy, E2E de navegador, migración/reimpresión QR, revisión de referer/logs y Wompi.
- **Decisión:** PR #534 continúa draft; no fusionar ni desplegar sin checks verdes y evidencia de aceptación. P0-70 PARCIAL, los 77 requisitos no certificados.

## Seguimiento de evidencia — 30-10-2026, ejecución posterior

- Nuevo commit `326910e`: dos regresiones unitarias para alias de sede con pedidos de otra empresa y registros históricos sin `empresaId`, y para rechazo de una sede aportada frente a un QR sin sede. La primera prueba usa un evaluador en memoria de las condiciones del filtro, **no** ejecuta MongoDB; no equivale a prueba HTTP/E2E ni demuestra el comportamiento de índices o consultas reales.
- Consulta de GitHub Actions y combined statuses para el HEAD anterior `910295f`: ambos devolvieron listas vacías. El commit nuevo requiere controles propios; **no existe CI verde confirmado en esta revisión**.
- Estado de aceptación: P0-70 **PARCIAL**. Pendientes: integración HTTP + MongoDB con colisiones de `restaurantId`/sede, legacy sin empresa, pruebas E2E, revisión de filtración de QR y migración/reimpresión, Wompi y verificación de secretos. Mantener #534 draft y no fusionar ni desplegar.

## Regresiones adicionales — 30-10-2026

- Commit `29444cf`: se añaden pruebas unitarias de QR manipulado y QR expirado; ambas comprueban respuesta 401, ausencia de filtro y **cero accesos a la base de datos**. Evidencia de código únicamente; no se afirma ejecución de pruebas ni CI verde.
- P0-70 continúa **PARCIAL**; pendientes HTTP/MongoDB real, E2E, migración de registros, revisión de exposición de tokens, pagos y CI verificable. PR #534 sigue draft; sin despliegue.

## Control del HEAD — 30-10-2026, 19:18 Colombia

- PR #534 sigue abierto y en borrador; base `gruk/security-realtime-sede-scope-20261030`, HEAD inspeccionado `a6fcd355d991f7f517ed1a1f5b554ef7ecbd33f7`. No fusionado.
- Consultas directas al commit exacto: GitHub Actions `workflow_runs: []` y combined status `statuses: []`. **No hay CI verde comprobable**; esta API puede omitir checks de otros eventos. Se prohíbe fusionar por ausencia de evidencia positiva.
- Revisión estática: filtros de `resolveMesaQrRead` con `empresaId` explícito para ambas ramas; 11 casos de prueba unitarios presentes, no ejecutados en esta revisión. No hay evidencia HTTP+MongoDB real ni E2E.
- Próximo bloque verificable: ejecutar suite y prueba HTTP con MongoDB real (empresas A/B, `restaurantId` coincidente, alias de sede, pedidos sin `empresaId`), obtener checks asociados al SHA exacto y registrar resultados. Mantener P0-70 PARCIAL, 0/77 criterios certificados, sin cambios a `main` ni despliegue.
