# GRUK Empresarial — trazabilidad P0-06 (Plan Maestro, ítem 06)

Fuente: `GRUK_Documentos_Unificados_Plan_Maestro.docx`, «Calidad de datos y conciliaciones».
Criterio oficial: **«Panel muestra diferencias y permite corregirlas de forma trazable»**.

> Estado: **PARCIAL / NO ACEPTADO**. Este documento no certifica pruebas que no estén vinculadas al SHA exacto ni implica autorización de despliegue.

| Obligación | Código / evidencia verificable | Estado y brecha |
| --- | --- | --- |
| Validar duplicados | `core/finanzas/reconciliacionExacta.js` — `idempotencyKey`, `duplicateKeys`; `test/gruk/p0-06-exact-reconciliation.test.js` | Parcial: solo lotes en memoria, no índice único ni transacción persistente |
| Movimientos sin soporte | Ningún adaptador de soportes persistidos identificado en este PR | Pendiente: vincular comprobantes/ventas reales y detectar faltantes |
| Conciliar caja y ventas | `reconcileMovements` calcula diferencia exacta de centavos y valida empresa/sede | Parcial: no lee cierres de caja, ventas ni pagos persistidos |
| Conciliar stock registrado vs físico | `core/finanzas/conciliacionStockExacta.js` y `test/gruk/p0-06-stock-exact-reconciliation.test.js`: comparación pura de cantidades enteras por producto/unidad, empresa/sede, límites, diferencias exactas y rechazo de registros duplicados | Parcial: sin adaptador de inventario real, conversión de unidades, conteos persistentes ni panel; requiere CI del HEAD exacto |
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
