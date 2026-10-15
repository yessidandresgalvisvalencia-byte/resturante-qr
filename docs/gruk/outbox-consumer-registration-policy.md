# GRUK sale-outbox consumer registration policy

## Mandatory invariant

An outbox event may reach `ENTREGADO` only after all registered delivery obligations are `ENTREGADO` and the two baseline consumers `CAJA_VENTA_V1` and `FACTURACION_VENTA_V1` exist and have acknowledged.

## Supported write paths

- Initial obligations are inserted with the sale event by `core/eventos/ventaOutbox.service.js` inside the sale transaction.
- Additional obligations MUST be created by `core/eventos/registrarConsumidorAdicional.service.js`, which updates the parent outbox version and inserts the obligation in one transaction.
- The global close service updates the same parent version before reading delivery obligations, fencing registration against closure.
- No controller, listener, scheduled task, or migration may directly insert additional `GrukEntregaConsumidor` records for an existing event outside these paths.

## Remaining deployment gate

Application-level controls are not a MongoDB authorization boundary. Before enabling the dispatcher, audit every write to `GrukEntregaConsumidor`, prevent unauthorized direct writes through database roles or an equivalent controlled write boundary, and verify concurrent registration/closure under a real replica set. These controls have not been certified for production.

Do not enable the legacy shared EventBus dispatcher: it acknowledges a shared event independently of the two durable consumer obligations.
