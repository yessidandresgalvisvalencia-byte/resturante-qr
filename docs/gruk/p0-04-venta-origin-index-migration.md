# P0-04 — Venta origin uniqueness: staged index migration

**Scope:** GRUK Empresarial `Venta` only. No automatic database migration or deployment is included in this PR.

## Why

The legacy unique partial index `{ origen: 1, origenId: 1 }` rejects the same external origin identifier across independent enterprises. The schema now declares `{ empresaId: 1, origen: 1, origenId: 1 }` with the existing ObjectId partial filter. The new index is not sufficient by itself: the legacy index remains in MongoDB until deliberately removed.

## Pre-deployment DBA checklist (manual, correct enterprise database only)

1. Identify the exact GRUK Empresarial database, collection name, replica set and current index names with `db.ventas.getIndexes()`. Never run against Personal or Blushea.
2. Confirm `empresaId` is present and valid on every record with an ObjectId `origenId`. Audit duplicates grouped by `{empresaId, origen, origenId}` before building. Resolve invalid records only through an approved, auditable remediation procedure.
3. Back up the collection and index definitions; confirm a restore rehearsal and maintenance window.
4. Build the new compound unique partial index online (using the index specification in `models/Venta.js`) and verify it exists and is ready. Check index-build errors and query plans.
5. Deploy the compatible application code only after validation and rollback readiness. **Do not drop the old index yet** until application reads/writes are verified against the new index.
6. With explicit DBA approval, drop only the verified legacy index by its exact discovered name, never by guessing the name. Confirm two tenants can use the same `origenId` while duplicates within one tenant remain rejected.
7. Monitor duplicate-key errors, sales creation and idempotent retries; capture logs, query results and approvals in the requirement evidence matrix.

## Rollback

Before legacy index removal: revert application commit; the old index still enforces stricter global uniqueness. After removal: a code revert alone does **not** restore the old constraint. To restore it, first audit cross-tenant duplicates and assess whether rebuilding the legacy index is feasible; otherwise use the forward fix and restore from the validated backup under DBA supervision. Never automatically recreate a global index over valid cross-tenant data.

## Acceptance status

Schema-level tests verify the declared index and tenant-required field only. They do **not** prove a real MongoDB migration, cross-tenant integration, E2E, production safety or complete P0-04. Keep this PR unmerged until CI, independent review and the migration plan are approved. Do not deploy Render as part of this change.
