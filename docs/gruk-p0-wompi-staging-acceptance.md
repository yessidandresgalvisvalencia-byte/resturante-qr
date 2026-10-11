# GRUK P0 — Wompi reconciliation staging acceptance

Status: **staging candidate only**. Never enable on production. No real charges are initiated by the reconciler.

## Mandatory configuration

- MongoDB must be a replica set: payment settlement and Outbox operate in a MongoDB ACID session.
- `NODE_ENV` must **not** equal `production`.
- Explicit opt-in: `GRUK_P0_PEDIDOS_ENABLED=true` and `GRUK_P0_WOMPI_RECONCILER_ENABLED=true`.
- `GRUK_P0_PEDIDOS_RESTAURANTES`: comma-separated **test restaurant IDs only**, no wildcard.
- Confirm trusted HTTPS access to `production.wompi.co/v1/transactions/{id}`. Review account/environment restrictions before using any gateway credentials.
- Run at an isolated staging database and take a verified backup before any migrations or real payment events.

## Automated acceptance

Run GitHub Actions GRUK CI against the staging branch. The Production Gate must run the MongoDB replica-set integration suite. Required scenarios:

1. Invalid currency/amount/reference causes no `Venta`, no Outbox and no `GrukIngresoConfirmado`.
2. Valid approved payment creates exactly one sale, two Outbox events and one income projection.
3. Two competing reconcilers cannot own the same live lease.
4. Lease expiry and worker restart respect persisted retry schedule.
5. Lease takeover during settlement rolls back sale and pending order changes.
6. Failures in claim/retry metadata writes do not leak raw provider error messages.
7. A delayed DECLINED/PENDING notification cannot revert an approved payment.

## Manual staging acceptance before rollout

- Verify real Wompi read-only transaction retrieval contract, access credentials and timeout under staging controls.
- Verify live webhook signature verification and real provider-replay behavior in a nonproduction tenant.
- Confirm exact payment matching: ID, reference, integer cents and COP currency.
- Test two independent staging application instances and abrupt process termination.
- Confirm outbox socket emissions are delivered to the authorized tenant room only.
- Monitor approved, unchanged, failed, stale lease, retry backlog and correlation IDs. Audit logs must never contain PAN, tokens, response bodies or raw gateway errors.
- Test crash/restart while settlement commits; compare Wompi result against MongoDB state.
- Verify no billing/subscription flows are affected.

## Unresolved blockers

- Attempts **without** a persisted `transactionId` are not recovered by this worker.
- Provider's read API semantics and credentials have not been externally certified.
- No production activation, migration sign-off, live card charge tests or deployment approval.
- Operational backout: disable `GRUK_P0_WOMPI_RECONCILER_ENABLED`; do **not** manually change approved payment states.

Production enabling requires explicit review and approval after these checks.
