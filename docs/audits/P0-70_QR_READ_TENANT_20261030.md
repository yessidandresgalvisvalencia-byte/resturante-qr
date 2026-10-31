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

## Revisión de controles y brecha de integración — 30-10-2026, 20:18 Colombia

- Inspeccionados el servicio `core/security/qrMesaRead.service.js`, los 11 tests con dobles de MongoDB y los cuatro archivos modificados del PR #534. El filtro de lectura exige `empresaId` tanto para sede canónica/alias como para pedidos sin sede; los registros históricos sin `empresaId` quedan excluidos.
- Consultados nuevamente los controles del SHA `a6fcd355d991f7f517ed1a1f5b554ef7ecbd33f7`: `workflow_runs: []`, `statuses: []`. Esto **no acredita CI verde** ni ejecución de los tests. El HEAD podría haber avanzado y debe comprobarse antes de cualquier fusión.
- Brecha concreta: los tests actuales simulan `findOne` y filtran arreglos JavaScript, por lo que **no prueban** semántica de `Pedido.find(scope.filter)` contra MongoDB real, ni las respuestas de ambas rutas GET. El próximo bloque debe montar dos empresas con `restaurantId`/mesa/alias coincidentes y pedidos legados, ejecutar HTTP real y capturar los resultados y checks del SHA.
- Decisión: P0-70 PARCIAL, 0/77 requisitos certificados; #534 permanece abierto, sin fusión ni despliegue. Auto-Deploy sobre `main` continúa como bloqueo operativo documentado.

## Comprobación de controles — 30-10-2026, 21:14 Colombia

- PR #534: abierto, draft, base `gruk/security-realtime-sede-scope-20261030` (#524), HEAD `e5a5f1a4009c97737269c89c0140971af71a7f60`; 4 archivos modificados, sin fusión.
- Consulta directa de GitHub Actions para el SHA exacto: `workflow_runs: []`; consulta de combined status: `statuses: []`. Ninguna consulta aporta evidencia de checks verdes. El conector de Actions solo expone la primera página de ejecuciones disparadas por PR; la ausencia de resultados no equivale a fallo ni aprobación.
- Contraste de código: `resolveMesaQrRead` exige `empresaId` en ambos filtros de pedidos; las 11 pruebas del archivo `test/gruk/p0-70-qr-read-enterprise-filter.test.js` emplean dobles de modelos o filtros en memoria. No constituyen pruebas de HTTP ni MongoDB real y no fueron ejecutadas aquí.
- **Bloqueo de aceptación:** falta runner de CI verificable y entorno aislado con MongoDB real para validar colisiones de restaurante/sede, legacy, GET de pedidos/facturas y E2E. No se fusiona #534 ni #524 ni se toca `main`/Render. P0-70 PARCIAL; 0/77 certificados. No se atribuye avance funcional nuevo a esta auditoría.

## Regresiones defensivas adicionales — 30-10-2026, 22:19 Colombia

- Commit `2c96d674c681190360ff56d94398d2406d8d7e06`: dos pruebas unitarias nuevas verifican que un QR de otra mesa se rechace antes de consultar restaurante/sede y que una clave HMAC insuficiente devuelva 503 sin consultar la base. Total: **13 pruebas escritas**, no ejecutadas ni certificadas por CI en esta revisión.
- La cobertura de aceptación P0-70 sigue **PARCIAL**: no hay evidencia de HTTP/MongoDB real, E2E, migración de registros históricos ni comprobación de pagos. No se debe fusionar ni desplegar. Estas pruebas no sustituyen los controles de integración.

## Verificación independiente — 30-10-2026, 23:19 Colombia

- HEAD confirmado por API del PR #534: `c4f295d7b1d8cb8f1ddc264c99b74c05ca556d1a`; PR abierto, **draft**, base `gruk/security-realtime-sede-scope-20261030`, cuatro archivos modificados.
- Consultas efectuadas para **ese SHA exacto**: `get_commit_combined_status` → `statuses: []`; `fetch_commit_workflow_runs` → `workflow_runs: []`. Este último endpoint solo cubre la primera página de ejecuciones disparadas por PR. **Resultado: CI no verificable, no CI aprobado**.
- Inspección del código del HEAD: ambos filtros de lectura de `resolveMesaQrRead` incluyen `empresaId: p.e`; el archivo de regresiones contiene 13 casos unitarios con modelos simulados, sin constancia de ejecución. No se debe confundir conteo de tests escritos con tests ejecutados.
- **Siguiente bloque funcional prioritario**: integración de las dos rutas HTTP GET (`/pedidos/mesa/:mesa` y `/factura/mesa/:mesa`) con MongoDB real, dos empresas y `restaurantId`/mesa/alias coincidentes, más pedidos históricos sin `empresaId`; comprobar códigos HTTP, proyección de datos, `Cache-Control`, y ausencia de filtración entre tenants. Registrar salida de suite y checks asociados al SHA posterior.
- **Bloqueo:** no hay evidencia positiva de runner/checks ni de fixture MongoDB real en esta ejecución. Mantener P0-70 PARCIAL y 0/77 requisitos integralmente certificados; no fusionar ni desplegar, no tocar Finanzas Personales ni Blushea.

## Corrección de contrato de regresión — 31-10-2026, 00:21 Colombia

- Al contrastar el cambio de `resolveMesaQrRead` con las pruebas existentes, se detectaron **dos aserciones obsoletas** en `test/gruk/p0-70-qr-mesa-read-capability.test.js`: esperaban filtros sin `empresaId` y, por tanto, eran incompatibles con el aislamiento empresarial introducido en #534. Corregidas en commit [`b4bd14a`](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/commit/b4bd14abeec37fad7c15d9897e6a1d74f85bbb23) para exigir `empresaId: empresa` tanto con sede como sin sede. No se cambió lógica de producción.
- Para el SHA `b4bd14abeec37fad7c15d9897e6a1d74f85bbb23`, las consultas de Actions y combined statuses devolvieron listas vacías. **No hay evidencia de ejecución exitosa** ni debe asumirse que la suite completa pasa.
- P0-70 continúa **PARCIAL**. Faltan pruebas HTTP/MongoDB real con colisiones, E2E, migración legacy, Wompi y revisión de seguridad. #534 sigue draft; no fusionar ni desplegar.

## Control de trazabilidad — 31-10-2026, 01:18 Colombia

- PR #534 confirmado **abierto, draft, no fusionado**; base `gruk/security-realtime-sede-scope-20261030`, HEAD `4b7e1f036fb7699f7656aa7a08075d61f78d3862`. PR padre #524 sigue abierto contra `main`; no confundir cambios apilados con cambios publicados.
- Consultas al HEAD exacto: `fetch_commit_workflow_runs` devolvió `workflow_runs: []`; `get_commit_combined_status` devolvió `statuses: []`. Son resultados sin evidencia positiva, **no** CI verde. No se ejecutaron pruebas en esta revisión.
- Verificación estática del código y 13 pruebas escritas: ambos filtros de `resolveMesaQrRead` incluyen `empresaId: p.e`; los tests usan modelos simulados y selección en memoria. No demuestran integración HTTP/MongoDB real, aislamiento de colisiones ni migración legacy.
- Bloqueo de aceptación P0-70: fixture real de dos empresas con `restaurantId` y alias de sede coincidentes, pedidos sin empresa, respuestas GET `/pedidos/mesa/:mesa` y `/factura/mesa/:mesa`, pruebas de navegador, revisión de filtración de tokens QR y checks del SHA final. Bloqueo de fusión a `main`: Render Auto-Deploy previamente identificado en servicios compartidos; no se verificó su desactivación.
- **Resultado: PARCIAL, 0/77 criterios integralmente certificados; no fusionar, no desplegar.** No hubo avance funcional ni ejecución de pruebas atribuibles a este control.

## Verificación de rutas y controles — 31-10-2026, 02:16 Colombia

- HEAD comprobado del PR #534: `a4d73c876f87f38b2b769f1b82597ce62de61f1c`, abierto, draft, base rama #524; #524 sigue abierto contra `main`.
- Inspección directa de `routes/API.js`: `GET /pedidos/mesa/:mesa` y `GET /factura/mesa/:mesa` consumen `resolveMesaQrRead`, aplican `Pedido.find(scope.filter)`, seleccionan campos de salida y fijan `Cache-Control: no-store`. La factura valida propina 0/10/15/20. Esto es **revisión estática**, no ejecución HTTP ni MongoDB.
- Consultas al SHA exacto: `fetch_commit_workflow_runs` devolvió `workflow_runs: []` y `get_commit_combined_status` devolvió `statuses: []`. El primer endpoint solo consulta la primera página de ejecuciones PR: **sin evidencia positiva de CI**, no inferir aprobación ni fallo.
- Pendientes de cierre: fixtures MongoDB real A/B con colisiones de `restaurantId`, mesa y alias, pedidos históricos sin empresa, validación HTTP de ambas rutas, E2E QR, exposición de token en URL/referer/logs, migración/reimpresión y controles Wompi. El subtotal/propina se calcula a partir de precios de pedidos; su exactitud monetaria no se ha certificado aquí.
- Decisión: P0-70 **PARCIAL**, 0/77 requisitos certificados integralmente. No fusionar #534/#524 ni desplegar mientras falten checks y aceptación; no modificar GRUK Personal ni Blushea.

## Regresiones de colisión — 31-10-2026, 03:21 Colombia

- Commit `ac7fb2e78ce1323bf190d83b0d2f160a57a40107`: dos pruebas negativas adicionales cubren rechazo de alias de sede distinto al del QR firmado y rechazo de un restaurante colisionado perteneciente a otra empresa **antes** de consultar sedes. Total del archivo: 15 pruebas unitarias escritas; **no se ejecutaron** y no sustituyen integración HTTP/MongoDB.
- Consultas realizadas para el HEAD anterior `a4d73c876f87f38b2b769f1b82597ce62de61f1c`: `workflow_runs: []`, `statuses: []`. No se ha obtenido CI verde del commit nuevo. No inferir resultado de checks ausentes.
- Estado real P0-70: **PARCIAL**; 0/77 requisitos certificados integralmente según última matriz conocida. Faltan fixtures MongoDB real con colisiones y legacy, respuestas HTTP de ambas rutas, E2E, control de tokens en URL/referer/logs, migración/reimpresión y pagos. No fusionar ni desplegar; mantener PR #534 draft y preservar GRUK Personal y Blushea.

## CI real identificado y corrección — 31-10-2026, 04:20 Colombia

- Consulta del endpoint de **check-runs** para HEAD `fb202d537405adf2576e6bf28ff0775dc9944d8b`: **GRUK Production Gate = FAILURE**, [job 124487967294](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41184312879/job/124487967294), ejecutado 08:22:09–08:22:51 UTC. El endpoint `fetch_commit_workflow_runs` devolvió `[]`, pero **no era prueba de ausencia de CI**. Consultar check-runs directamente en adelante.
- Log recuperado: **916 pruebas, 915 pasan, 1 falla**. Falló `test/gruk/p0-70-qr-order-write-scope.test.js:39` porque la aserción esperaba un filtro sin `empresaId`; el servicio sí devuelve el campo de aislamiento requerido. Se corrigió **solo la expectativa del test**, sin relajar el filtro de producción, commit [`dd36f65`](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/commit/dd36f65eb229cbd42c1880b019a6ea7d938dd5c2).
- **Pendiente:** obtener check-runs verdes para el SHA actualizado, ejecutar HTTP/MongoDB real y E2E; revisar todos los gates. No se afirma que el arreglo haya pasado hasta disponer de ejecución positiva. P0-70 PARCIAL; 0/77 requisitos certificados integralmente. PR #534 draft, sin fusión ni despliegue.

## Control de evidencia — 31-10-2026, 05:20 Colombia

- PR #534: abierto, draft, sin fusionar; HEAD `617a5460b160f217aa02d11daf04c6d016b89fb4`; PR #524 permanece abierto contra `main`. Los cambios de #534 están apilados sobre #524, no publicados.
- Consultas al HEAD exacto: `fetch_commit_workflow_runs` → `workflow_runs: []` y `get_commit_combined_status` → `statuses: []`. **No hay prueba de controles verdes para este SHA**. La consulta de workflow runs se limita a ejecuciones PR de primera página; no interpretar lista vacía como aprobación.
- Revisión estática del servicio: `resolveMesaQrRead` exige `empresaId` en la consulta del restaurante, en la consulta de sede y en ambos filtros de pedidos. Las 15 pruebas del archivo `p0-70-qr-read-enterprise-filter.test.js` son unitarias con modelos simulados o evaluación de arreglos; no hay evidencia de ejecución en esta revisión.
- La corrección anterior `dd36f65` de aserción obsoleta aún no está respaldada por CI verde en el HEAD actual. Falta integración HTTP/MongoDB real con dos tenants, colisiones y pedidos legados, validación de las dos rutas GET, E2E, migración/reimpresión QR, seguridad de tokens y Wompi.
- **Decisión:** P0-70 PARCIAL; 0/77 requisitos certificados integralmente. No fusionar, no desplegar. Auto-Deploy Render sobre `main` sigue siendo bloqueo no resuelto. No se ejecutó suite local ni se implementó bloque nuevo en este control.

## Auditoría de unicidad intraempresa — 31-10-2026, 06:22 Colombia

- PR #534 sigue abierto/draft (HEAD inspeccionado `60ac9e38bec7c5bb54efb68ee43fce56f1e6ea50`), dependiente de #524 abierto. La consulta de workflow runs para ese SHA devolvió `[]`; **no acredita CI aprobado** y debe contrastarse con check-runs (la ejecución fallida anterior sí apareció por esa vía).
- **Nueva brecha específica de aislamiento detectada por lectura estática:** `resolveMesaQrRead` confirma la existencia del restaurante con `Restaurante.findOne({restaurantId,empresaId})`, pero la lectura de pedidos filtra por `empresaId,restaurantId,mesa,sedeId` y no por el `_id` del restaurante. Si dos restaurantes de **una misma empresa** comparten `restaurantId`, los pedidos de la misma mesa/sede podrían mezclarse. La protección interempresa no prueba unicidad intraempresa. Verificar índices únicos `{empresaId,restaurantId}` y semántica de creación/importación antes de certificar; si no existe invariante, corregir identidad y consultas con migración compatible.
- **Otra brecha a validar:** los alias `codigoSede` se aceptan en `$in` sin prueba de unicidad por restaurante. Una colisión de alias de dos sedes podría incluir pedidos de otra sede dentro del mismo tenant. Exigir índice/invariante de unicidad y pruebas MongoDB de duplicados, incluidos datos históricos.
- Prueba de aceptación pendiente: fixtures con (a) dos empresas con restaurantId coincidente, (b) dos restaurantes de una empresa con restaurantId duplicado, (c) dos sedes con codigoSede duplicado, (d) pedidos sin empresa y (e) accesos HTTP a ambas rutas de lectura. Verificar rechazo seguro o ausencia de mezcla, y documentar índices/migración. No se ejecutaron pruebas nuevas ni se atribuye corrección funcional.
- P0-70 continúa **PARCIAL**, 0/77 verificados integralmente. Sin fusión, sin cambios a `main`, sin despliegue.

## Revisión de unicidad de esquema — 31-10-2026

- Inspección directa: `models/restaurante.js` declara `restaurantId: { unique: true }` global; `models/sede.js` declara `codigoSede: { unique: true }` global. Esto reduce la posibilidad de colisiones **si los índices están realmente construidos**, pero NO demuestra su existencia en la base desplegada ni ausencia de duplicados heredados. La unicidad es global, no compuesta por empresa; hay que evaluar compatibilidad de negocio y migraciones antes de modificar índices.
- Commit `7e4c04e`: prueba adicional de regresión que comprueba declaraciones del esquema, no prueba MongoDB ni carrera concurrente. Total en `p0-70-qr-read-enterprise-filter.test.js`: 16 pruebas escritas (15 anteriores + 1 nueva), sin ejecución confirmada.
- PR #534 HEAD anterior `6d32246fe258643c7ff6bcf0dd29326467506b0e`: consultas de workflow runs y combined statuses retornaron listas vacías el 31-10-2026; **no interpretar vacío como verde**. Reconsultar el nuevo HEAD tras los commits.
- Para certificar: inspeccionar `getIndexes()` real de las colecciones y errores E11000 con escrituras simultáneas; ejecutar HTTP+MongoDB real con tenants y alias en conflicto, validar registros históricos y rutas de lectura, registrar CI verde verificable. P0-70 sigue PARCIAL. Sin merge ni despliegue.


## Control de alcance y evidencia — 31-10-2026 09:19 Colombia

- Se inspeccionaron directamente `core/security/qrMesaRead.service.js`, `test/gruk/p0-70-qr-read-enterprise-filter.test.js`, `test/gruk/p0-70-qr-mesa-read-capability.test.js` y `package.json` en la rama de #534. El filtro de lectura sí exige `empresaId`, `restaurantId`, `mesa` y sede autorizada; el modelo de pruebas sigue siendo simulado, no MongoDB real.
- Se detectó una limitación operativa adicional: `package.json` define `npm test` y `gate` exclusivamente con pruebas Node y sintaxis; no incluye un comando específico para integración HTTP con MongoDB real. Por tanto, un gate unitario verde no certifica el criterio P0-70.
- Se consultó el estado de los PR abiertos: #521, #522, #523, #524 y #534 siguen en la cola de integración; #534 se mantiene apilado sobre #524. La matriz en `main` sigue en estado inicial y no debe utilizarse como prueba de avance del PR.
- No se ejecutaron pruebas nuevas ni se introdujo funcionalidad nueva en este control. Se requiere fixture MongoDB real, rutas HTTP de pedidos/factura, colisiones entre empresas, históricos, pruebas de concurrencia y evidencias CI para el SHA final. Mantener P0-70 PARCIAL y 0/77 certificados; no fusionar a `main` ni desplegar mientras Render Auto-Deploy y los demás bloqueos sigan sin resolverse.
