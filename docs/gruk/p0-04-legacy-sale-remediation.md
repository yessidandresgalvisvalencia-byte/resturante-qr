# P0-04 — Remediación de 16 ventas legacy sin sede (bloqueada hasta evidencia real)

## Evidencia comprobada (20-11-2026)

La ejecución real de auditoría de solo lectura [#44767149984](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44767149984), en la base empresarial `restaurante`, encontró 16 ventas; 16 tienen `sedeId: null`, 0 tienen `sedeId` ausente, 0 tienen otro tipo, 16 tienen exactamente una sede candidata **actual** por `empresaId`, 0 tienen varias. La auditoría reporta `readyForIndexBuild: false` y `safeToMigrate: false`.

**Una única sede actual no demuestra la sede utilizada históricamente.** Está prohibido asignar automáticamente esos 16 registros, crear índices de corte o quitar índices heredados hasta confirmar cada procedencia.

## Orden de trabajo seguro

1. Obtener una copia **real** cifrada y privada de la base `restaurante`, exclusivamente. Almacenarla fuera del repositorio; custodiar claves por separado. Registrar referencia de evidencia privada. El gate sintético del repo no reemplaza este respaldo.
2. Restaurar la copia en un MongoDB aislado y verificar conteos, importes, hashes y acceso de la aplicación recuperada. Registrar pruebas y aprobación independiente. Nunca restaurar encima de producción.
3. Investigar por venta `metadata.pedidoId`, `metadata.restaurantId`, `origenId`, registros originales de pedido, empresa y referencia a sede. Registrar la justificación privada de `sedeId`, incluso si hoy hay una sola sede. No inferir sede únicamente por cardinalidad actual.
4. Generar en almacenamiento privado un manifiesto JSON con `database`, `confirmDatabase`, `sourceAuditRun`, `expectedAffectedSales`, `backupEvidence`, `independentDbaApproval` y exactamente 16 `mappings`, cada uno con `saleId`, `empresaId`, `sedeId`, `historicalSourceVerified`, `privateProvenanceReference`. No subir este archivo ni identificadores a GitHub.
5. Validarlo localmente con `GRUK_PRIVATE_REPAIR_MANIFEST=/ruta/privada/manifest.json node scripts/gruk/p0-04-legacy-sale-repair-manifest.js`. Solo imprime conteos y errores, sin identificadores y **no escribe en ninguna base**.
6. El responsable DBA debe validar de nuevo la existencia de cada venta, pertenencia a la empresa y sede, `sedeId: null`, ausencia de alteración concurrente y el respaldo antes de autorizar una transacción de corrección. Guardar auditoría inmutable y antes/después fuera de datos públicos; no cambiar montos, totales, pagos ni inventario.
7. Repetir la auditoría real P0-04. La liberación de índice y del despliegue sigue sujeta a aprobación de DBA, controles de aislamiento y pruebas de producción.

## Estado

El repositorio no contiene credenciales con permisos de escritura ni evidencia de una restauración probada de los datos reales. El validador comprueba integridad **declarativa** del manifiesto, no verifica por sí mismo la autenticidad del respaldo, la firma del aprobador ni la correspondencia histórica. Por diseño, no ejecuta ninguna migración, incluso si recibe datos válidos.
