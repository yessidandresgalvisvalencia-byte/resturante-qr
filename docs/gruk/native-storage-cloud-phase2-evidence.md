# GRUK Storage — cloud phase 2 evidence (2026-11-26 Colombia)
Scope: restaurante only. No real backup or restore authorized or executed.

## Verified
- GitHub manual preflight run 45932537744 reached VAULT_CONNECT_NETWORK_OR_TLS after source role and dbStats checks.
- Render service resturante-qr-1, deploy dep-dc4fji49v7es73eqc38g, commit 6a960e84175ad2390b7bbdcb316417d401381990, emitted READ_ONLY_PREFLIGHT at 2026-11-27T03:33:04.959Z.
- sourceRoleVerified=true; estimatedArchiveBytes=18814230; internalRemainingBytes=33554432; internalCapacityScreenPassed=true; atlasPhysicalCapacityVerified=false; realBackupEnabled=false; restoreVerified=false.
- Temporary readiness flags disabled; closing deploy dep-dc4fm7jl550s7395sj4g live at 2026-11-27T03:38:39.792Z.
- Prior synthetic cloud vault restore evidence: Actions run 45922728939, job 140256981897 (not production data).

## Cloud-only target, pending release
Existing separate Atlas vault is a candidate durable ciphertext store; Render ephemeral disk may only be temporary staging, never durable storage. This is an alternative to the physical-host proposal in native-storage-production-readiness.md, not approval to waive independent failure domains or other acceptance gates. No claim of independent physical replication.

## Founder-supplied Atlas dashboard snapshot (2026-11-26 Colombia)
GRUKStorage Free, AWS us-east-1, MongoDB 8.0.39, three-node replica set. Data Size 36.03 KB / 512.00 MB; connections 0 / 500; native backups inactive. Dashboard values supplied by founder, not independently queried via Atlas API. Reported data-size headroom supports the first estimated 18,814,230-byte archive; actual storage accounting, indexes, overhead and future growth remain subject to monitoring. Application cap remains 32 MiB unchanged. Replica set is not an independent backup. No change to runtime capacity gates.

## Remaining gates
1. Initial dashboard data-size and quota evidence received; verify actual post-publication storage accounting, growth headroom and recurring restricted network access. Internal 32 MiB application cap is not Atlas physical capacity.
2. Define key custody: AGE recipient plus independently recoverable private identity, Ed25519 signing key and trusted keyring. No private keys in git, logs or ciphertext database; verify recovery without customer data. No assumption that an independent durable recovery-key store exists.
3. Design approved cloud-only execution path with bounded ephemeral staging, verified tools, signed publication and readback, isolated restore, cleanup, concurrency and rollback. Keep current real-backup gates closed.
4. Obtain explicit founder approval for one real read-only restaurante backup and isolated restore. Never restore into production or Finanzas Personales. Recurrence requires separate approval.
5. Record real restore evidence, independent failure domain and retention/recovery objectives before definitive production acceptance.

No new service or spending authorized. The existing production readiness document remains applicable where not explicitly superseded by a reviewed release.
