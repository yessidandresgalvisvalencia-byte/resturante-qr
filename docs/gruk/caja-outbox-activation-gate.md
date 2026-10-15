# Caja outbox opt-in dispatcher: activation gate

The adapter `core/eventos/cajaVenta.dispatcher.js` is intentionally NOT scheduled or wired into app startup.

## Blocking conditions

1. The existing `ventaOutbox.dispatcher.js` marks an event ENTREGADO after its configured emitter succeeds. The Caja-specific adapter only acknowledges Caja; therefore, using it on a shared event stream would incorrectly imply delivery to Facturacion, Finanzas and other consumers. Do not invoke this adapter against production shared outbox until delivery tracking is per consumer, or all required consumers are durably coordinated.
2. The legacy EventBus Caja listener does not await its asynchronous side effects. Do not run the durable dispatcher concurrently with that listener.
3. Prove concurrency, rollback, tenant isolation and recovery from interrupted leases in CI.
4. Define bounded retries, dead-letter/quarantine, observability and safe deployment rollback.
5. Preserve the atomic derived `CAJA_MOVIMIENTO_REGISTRADO` notification via transactional outbox before switching the listener.

The adapter is a preparatory integration point, not a production-ready worker.
