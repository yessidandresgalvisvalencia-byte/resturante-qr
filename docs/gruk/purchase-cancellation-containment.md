# P0-05 / P0-06 — purchase cancellation containment

The original endpoint only changed Compra.estado to anulada. It did not compensate inventory movements, weighted-average valuation, supplier liabilities or financial projections. As a preventive measure, new cancellations return HTTP 409 (GRUK_COMPRA_REVERSO_REQUERIDO) without writes. Already cancelled records return their existing state; this does not certify their historical reconciliation.

This deliberately restricts existing functionality until the following are proven: original movement completeness, stock availability and subsequent consumption, cost valuation, payment/refund and liability reconciliation, transactional concurrency and idempotency, immutable compensating movements and events, tenant/branch authorization, and a persisted end-to-end test. No historical migration or data repair is included. The limitation must be reviewed before production release.
