# Auditoría de consumidores VENTA_COMPLETADA — bloqueo de activación

Fecha: 2026-10-15. Rama: `feat/gruk-enterprise-tenant-idempotency-audit`.

## Evidencia directa

- `app.js` registra los listeners de Caja, Finanzas, Junta Viva, Facturación y un listener de log para `VENTA_COMPLETADA`. Agenda Financiera se registra, pero su lista `EVENTOS_AGENDA` no incluye `VENTA_COMPLETADA`.
- `intelligence/listeners/caja.listener.js` encola `registrarMovimientoDesdeEvento` sin devolver la promesa al EventBus. La cadena además captura y registra errores. El despachador **no puede esperar ni conocer** el resultado financiero.
- `core/facturacion/facturacion.listener.js` usa una función `async`, pero captura el fallo de `prepararDesdeVenta` y no lo vuelve a lanzar. El despachador puede interpretar ese fallo como éxito.
- `intelligence/listeners/finanzas.listener.js` programa `ejecutarCicloEmpresa` mediante `setImmediate`, con errores aislados; no confirma la ejecución.
- `intelligence/listeners/juntaViva.listener.js` programa `recalcularEstadoVivo` mediante `setImmediate`, sin confirmación durable por evento.
- El despachador `core/eventos/ventaOutbox.dispatcher.js` espera las promesas devueltas por listeners, **no** el trabajo diferido que estos no devuelven.

## Riesgo

Conectar el despachador a los listeners heredados puede marcar `VENTA_COMPLETADA` como `ENTREGADO` antes de que Caja registre el movimiento. Un error posterior podría quedar solo en logs. Por ello el outbox no debe habilitarse todavía en producción.

## Secuencia de corrección

1. Crear un consumidor **durable específico de Caja**, que reciba `eventId` estable y use `consumirEventoUnaVez` para persistir efecto financiero y recibo en una misma transacción.
2. Auditar `registrarMovimientoDesdeEvento` y todos sus efectos secundarios antes de adaptarlo; no envolver ciegamente operaciones que internamente abren otras sesiones o publican eventos.
3. Separar consumidores durables (confirmación de efectos críticos) de proyecciones de lectura, inteligencia y notificaciones, que requieren sus propias garantías de actualización y recuperación.
4. No usar listeners heredados con errores capturados como evidencia de ACK.
5. Probar fallo antes del commit, fallo después del commit, duplicados concurrentes, tenants cruzados, caída del proceso y recuperación.
6. Activar el worker solo con lista explícita de consumidores durables registrados, métricas, alertas, política de reintentos y rollback.

**No se modifican los listeners existentes en este documento**: hacerlo sin conocer sus dependencias podría romper la operación actual.
