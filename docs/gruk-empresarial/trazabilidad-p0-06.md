# GRUK Empresarial — trazabilidad P0-06 (Plan Maestro, ítem 06)

Fuente: `GRUK_Documentos_Unificados_Plan_Maestro.docx`, «Calidad de datos y conciliaciones».
Criterio oficial: **«Panel muestra diferencias y permite corregirlas de forma trazable»**.

> Estado: **PARCIAL / NO ACEPTADO**. Este documento no certifica pruebas que no estén vinculadas al SHA exacto ni implica autorización de despliegue.

| Obligación | Código / evidencia verificable | Estado y brecha |
| --- | --- | --- |
| Validar duplicados | `core/finanzas/reconciliacionExacta.js` — `idempotencyKey`, `duplicateKeys`; `test/gruk/p0-06-exact-reconciliation.test.js` | Parcial: solo lotes en memoria, no índice único ni transacción persistente |
| Movimientos sin soporte | `core/finanzas/verificacionSoportesP006.js` y `test/gruk/p0-06-evidence-verification.test.js`: detección determinista de referencias ausentes, duplicadas y fuera de empresa/sede | Parcial: requiere lectura de soportes reales, vínculo con ventas y CI del HEAD exacto; no hay escritura ni autorización |
| Conciliar caja y ventas | `core/finanzas/conciliacionMongoIntegradaP006.js` enlaza colecciones Mongo explícitas con `repositorioConciliacionMongoAcotado.js` y `lecturaConciliacionAcotada.js`; `lecturaVentasPersistidasP006.js` lee `Venta` acotada por empresa/sede | Parcial: el integrador requiere colecciones normalizadas y `expectedCentavos` independiente; no conecta por sí solo cierres reales, pagos ni ledger persistente. `Venta.total` heredado de tipo Number no debe entrar al ledger exacto sin conversión validada |
| Conciliar stock registrado vs físico | `core/finanzas/conciliacionStockExacta.js`, `repositorioConciliacionMongoAcotado.js` y `conciliacionMongoIntegradaP006.js`; tests `p0-06-stock-exact-reconciliation.test.js` y `p0-06-mongo-integration-contract.test.js` | Parcial: contrato de colecciones normalizadas, no integración acreditada con conteos físicos de producción, conversiones de unidad ni panel |
| Panel de diferencias | Sin interfaz en este PR | Pendiente: visualización con permisos por empresa y sede |
| Corrección trazable | Sin escritura ni auditoría en este PR | Pendiente: ajuste compensatorio, actor, fecha, motivo, soporte y bitácora inmutable |
| Aislamiento multiempresa | Validación negativa de empresa/sede en la función pura; tests P0-06 | Parcial: faltan integración DB y pruebas de autorización de rutas |
| Precisión y límites | BigInt interno, centavos en cadenas, rechazo de rangos inválidos; tests P0-06 | Parcial: faltan consumidores y contrato E2E del ledger |
| Idempotencia/concurrencia | Deduplicación en lote y rechazo de conflictos | Parcial: faltan transacciones concurrentes reales y reintentos distribuidos |

## Gate de aceptación

- [ ] Adaptador a datos persistidos de ventas, caja, stock y soportes; lectura acotada por empresa/sede.
- [ ] Ajustes compensatorios persistentes con autorización, motivo y auditoría inmutable; sin sobrescribir historia.
- [ ] Panel de diferencias basado en transacciones reales, con trazabilidad de correcciones.
- [ ] Tests de integración MongoDB, aislamiento entre empresas, concurrencia, fallos y E2E financiero.
- [ ] Auditoría de seguridad, revisión independiente y CI verde del HEAD exacto.
- [ ] Plan de rollback validado y verificación de Render antes de cualquier despliegue.

## Evidencia CI del HEAD anterior a este archivo

Commit `a1263c3e2f986e50fd3b596bd49f3a272e63006f`: cuatro ejecuciones `completed/success` consultadas el 2026-11-21:

- GRUK CI: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44923424195
- Quality gate: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44923424311
- Offline Browser Persistence: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44923424223
- P0-04 Venta Index Real MongoDB: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44923424181

**Estos resultados no certifican el commit que incorpora esta matriz.** No fusionar este PR hasta completar los gates; no tocar GRUK Finanzas Personales ni Blushea.

## Registro de alcance de integración (22-nov-2026)

La función `reconcileFromMongoCollections` exige explícitamente `empresaId`, `sedeId`, `movementsCollection`, `stockCollection` y `expectedCentavos`; no descubre modelos ni concede permisos. El suministro de colecciones y el origen independiente del saldo esperado siguen siendo responsabilidad del consumidor autorizado. Las pruebas de contrato de adaptadores no sustituyen un ensayo E2E contra MongoDB y fuentes operativas reales. No transformar `Venta.total` de tipo Number a centavos por redondeo implícito ni considerar el resultado como asiento contable. Cualquier ajuste futuro debe ser compensatorio, autorizado y auditable.

Matriz de evidencia: requisito 06 → integrador `core/finanzas/conciliacionMongoIntegradaP006.js` → prueba `test/gruk/p0-06-mongo-integration-contract.test.js`; requisito 06 → lectura `core/finanzas/lecturaVentasPersistidasP006.js` → prueba `test/gruk/p0-06-persisted-sales-read.test.js`. **Estado: parcial, sin aceptación funcional ni permiso de merge/despliegue.**

## Compatibilidad con cursor MongoDB (22-nov-2026)

- Requisito 06 / soportes persistidos → `core/finanzas/verificacionSoportesMongoP006.js` → `test/gruk/p0-06-mongo-prototype-cursor.test.js`.
- Cambio: resolución de `limit` y `toArray` mediante descriptores de datos en la cadena de prototipos del cursor, sin ejecutar getters. Los métodos del driver MongoDB se exponen normalmente por prototipo; la lectura anterior exigía métodos propios y podía rechazar un cursor legítimo.
- Pruebas agregadas: cursor con métodos en prototipo, accessor malicioso no ejecutado y rechazo de un registro de otra empresa.
- Evidencia: commits `51bb558490f7ae54890b81f831d94c6db58b79c2` y `29e4c25c297328197fcb19da3ec1092f614dd1fd`. CI del HEAD final pendiente de comprobar; **no equivale a prueba Mongo real ni aceptación P0-06**.

## Colecciones Mongo con métodos heredados (22-nov-2026)

- Criterio P0-06 / soportes persistidos: `core/finanzas/verificacionSoportesMongoP006.js` acepta `Collection.find` declarado en prototipo (como el driver MongoDB) y rechaza getters sin ejecutarlos.
- Regresión: `test/gruk/p0-06-mongo-prototype-collection.test.js` cubre colección y cursor con métodos heredados, además de getter malicioso.
- Commits: `288393cd1d78c07865588a441d5d659c6eea8aad`, `515f20e3430c782bbe832ec1c2611b63f536733e`.
- CI del segundo commit: cero ejecuciones devueltas al consultar; **pruebas no certificadas**. Sin integración real de Mongo, panel, ajustes auditables ni aceptación E2E. No fusionar ni desplegar.
