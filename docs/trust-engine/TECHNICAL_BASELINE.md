# Trust Engine — technical baseline (partial)

Base: 1bd9f3554515143f3fff8e58587e4188e95d6c1e
Scope: Empresarial and Finanzas Personales V81; personal product inventory not yet verified.

## Observed architecture
- app.js: Express, MongoDB, Socket.IO, financial and intelligence listeners, health routes, security middleware, offline routes.
- HTTP and socket authentication share claims and session version validation.
- routes/sync.js: authenticated batch inbox, status, reconciliation, catalog, stock snapshot, privileged staging and conflict review/retry.
- Batch acceptance explicitly returns applied:false. Staging is not payment capture or fiscal sale.
- Offline route checks are not proof of service-level tenant isolation or complete financial posting.

## Risk register
| ID | Finding | State | Next evidence |
|---|---|---|---|
| TRUST-SEC-001 | Legacy tokens without identity bypass version lookup; current user issuer corrected on branch | IN_PROGRESS | Complete issuer inventory, migration and HTTP/socket tests |
| TRUST-SEC-002 | Inherited model keys accepted by lookup before branch fixes | IMPLEMENTED_UNVERIFIED | Latest CI and targeted test results |
| TRUST-SEC-003 | Client request ID copied into response header | GAP_IDENTIFIED | Coordinate existing PR #653; do not duplicate |
| TRUST-SEC-004 | Legacy plaintext password compatibility in login | GAP_IDENTIFIED | Determine remaining accounts using authorized non-production evidence; migration plan |
| TRUST-OFF-001 | Offline acceptance/staging not equivalent to final payment and fiscal posting | NOT_EVALUATED | Trace end-to-end ledger, stock and cash tests |

## Parallel work
Review PRs #610, #648, #652, #653, #654 before overlapping changes. No merge or deployment authorized.

## Evidence
Commit 26e955cac3688409c81c1e8949211b0e1ac350eb: four successful workflows (45416061927, 45416061939, 45416061877, 45416061777).
Commit 37e4e30c51fc7ed4c87503e63c12896b2a07b7c3: MongoDB workflow 45418125529 successful; other workflows in progress when observed.
No certification or complete offline operation claimed.
