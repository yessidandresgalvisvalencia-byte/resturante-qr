# GRUK Storage — native production readiness

Status: BLOCKED FOR REAL BACKUPS. 2026-11-26.
Scope: GRUK Empresarial only; source database restaurante. No Google Drive dependency in the target architecture.

## Verified evidence
- Native contract at commit 0450af0c0962bdd4aede9b35903664cd312116a3: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/45887330561/job/140141183555
- Genuine AGE encrypted synthetic MongoDB restoration from signed replica: GRUK_SYNTHETIC_SIGNED_REPLICA_RESTORE_OK.
- Independent catalog worker connectivity and transactional synthetic permissions: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/45883437284/job/140128154252
- Synthetic same-device replicas are not proof of independent physical storage.

## Infrastructure decision
Existing Render service resturante-qr-1 uses Free compute, ephemeral filesystem and main branch with automatic deployments off. It must not host permanent vault files. See https://render.com/docs/free and https://render.com/docs/disks.
Preferred no-new-subscription path: founder-authorized existing Linux host with persistent local storage, plus a separately verified secondary storage failure domain. No hardware availability is assumed. Electricity, network and hardware costs are not assumed to be zero.
MongoDB Atlas catalog is metadata only, not a substitute for backup vaults. GitHub Actions artifacts and repositories are not permanent vaults.
Do not create paid services, change Render configuration, or expose the storage listener publicly.

## Acceptance gates (all required before release)
1. Identify authorized host and owner; verify persistent mount survives restart and service-account permissions. Primary and secondary private roots must be non-overlapping, independently provisioned and backed by distinct failure domains; verify actual physical/host independence, not merely device IDs.
2. Check available capacity, growth, retention and recovery staging space; do not automatically delete archives. Document recovery objectives and operational owner.
3. Provision dedicated non-root service account, restrictive filesystem access, localhost listener, firewall, controlled egress to Atlas. No wildcard Atlas IP allowlist. Confirm recurring network access and TLS.
4. Provision AGE recipient and independently protected recovery identity, Ed25519 active signing key and trusted keyring, separate local API authentication key. Never commit or log secrets. Verify key recovery independently.
5. Verify independent catalog and source read-only credentials, host and database separation. Leave catalog and real backup flags disabled until authorization.
6. Audit native workflows and entrypoints; legacy Drive workflows are not approved for new operations. Native runtime and service currently explicitly reject real backups. Do not remove these gates without a separate approved release, successful end-to-end checks and a rollback plan.
7. Run synthetic restore on actual infrastructure across both failure domains, restart recovery, interrupted replication, low capacity and damaged primary; confirm document values and indexes.
8. Obtain founder authorization for one real read-only restaurante backup and isolated restore; do not restore to production. Review evidence, then separately approve recurrence and monitoring.
9. Keep GRUK Finanzas Personales and other projects isolated; no source database modifications.

## Open blockers
Authorized host and disks unknown; recurring Atlas network access and production keys unverified; runtime real-backup release blocked; no real backup/restore certified. Master document unavailable for scope reconciliation. No new spending authorized.

## Legacy external storage workflow retirement
The phase-2 branch removes manual dispatch and real backup jobs from the historical Google Drive and S3 workflows. Synthetic regression tests remain, including provider-neutral catalog and signature code whose filenames retain historical naming. This does not delete remote files or credentials, or change the main branch. Native storage remains blocked for real operations pending infrastructure approval. Direct legacy script entrypoints and other runtime routes require separate review before final release.
