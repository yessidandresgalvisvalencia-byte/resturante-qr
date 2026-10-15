# Plan de migración transaccional de Caja — evidencia de código

Revisión de `core/finanzas/caja.service.js`, `core/finanzas/models/MovimientoCaja.js` y `intelligence/listeners/caja.listener.js` en la rama de trabajo.

## Bloqueadores técnicos verificados

1. `registrarMovimientoDesdeEvento(event, opciones)` **no acepta sesión MongoDB**. `confirmarMovimiento`, `reversarMovimiento`, `buscarConfirmacionActiva`, `crearIdempotente` y `resolverCuentaPorMetodo` tampoco comparten una sesión recibida. Por tanto, **no se puede invocar este servicio dentro de `consumirEventoUnaVez` y asumir atomicidad**.
2. `crearIdempotente` captura error `11000` y busca por `claveIdempotencia`, pero el índice es global y la búsqueda de recuperación no filtra `empresaId`. El índice y la consulta necesitan revisión multi-tenant antes de una migración.
3. `claveIdempotencia` se deriva de origen, identificador, tipo de asiento y marca temporal; **no utiliza el identificador estable del evento outbox**. Esto impide equiparar la deduplicación de Caja con el recibo durable de consumidor.
4. `confirmarMovimiento` realiza una consulta de confirmaciones activas seguida de creación. Esa secuencia requiere protección ante concurrencia, además del índice existente.
5. El listener `caja.listener.js` usa colas en memoria, captura errores y no devuelve la promesa del movimiento al despachador. No es una confirmación durable.
6. `registrarMovimientoDesdeEvento` emite `CAJA_MOVIMIENTO_REGISTRADO` después de crear el movimiento; no existe una garantía de publicación atómica de ese evento derivado.

## Contrato mínimo para migración

- Todas las consultas y escrituras de un movimiento, la resolución de cuenta y el recibo `GrukEventoProcesado` deben compartir **la misma sesión transaccional**.
- Filtrar cualquier recuperación de clave duplicada por `empresaId` y comprobar la migración de índices antes de modificar unicidad en producción.
- Persistir el evento derivado de Caja en un outbox propio dentro de la transacción, si los consumidores requieren entrega garantizada; no emitirlo como confirmación transaccional.
- Probar reintentos, colisiones de claves, concurrencia multi-tenant, fallos entre escrituras y recuperación.
- No registrar el listener actual como consumidor durable ni habilitar el worker todavía.

**Alcance:** este documento establece riesgos y criterios de migración; no afirma que Caja ya sea transaccional.
