# Native backup storage — deployment gate
Status: IMPLEMENTED_UNVERIFIED. No production changes.
Base: 1bd9f3554515143f3fff8e58587e4188e95d6c1e.
The filesystem adapter requires an independently provisioned private persistent volume, mode 0700, owned by the backup runner. A free Render service filesystem or GitHub hosted runner temporary disk is not a durable backup destination. No paid resource is authorized.
A dedicated owner-controlled computer with a separate encrypted external disk is a possible no-new-subscription deployment if hardware already exists; availability, capacity, encryption and independent copy must be confirmed. Do not install a self-hosted runner on a personal machine without explicit approval and isolation.
Before real data: verify synthetic CI, genuine AGE encryption/decryption, Mongo isolated restore, persistence across restart, authenticated digest receipt stored independently, recovery key custody, retention and capacity, independent disaster copy. Header checking is not cryptographic authentication. File no-overwrite is not WORM protection against privileged deletion. Current live dump comparison may fail under concurrent writes; no point-in-time consistency claim.
Never use GitHub source, public artifacts or the primary Mongo database as the sole backup. Keep existing Drive configuration untouched until a replacement is verified. No production drill, merge, spending or deployment authorized in this block.

## Interrupted backup recovery

Recovery inspection is read-only. A lock directory or unexpected entry requires review; age or PID alone never proves a lock is abandoned. Stop all backup writers and verify that no child backup process remains before any authorized manual intervention. Preserve archives and incomplete files for investigation. Do not remove or replace a lock while a writer may still be active. Resume only after independent integrity and restore checks. The inspection is not an automatic recovery or deletion mechanism.

## Runtime integration and administrative alerts

The normal CLI remains listener-only: real backup execution is release-blocked and the scheduler must not generate fictitious successful backups. Automated scheduling is exercised through explicit in-process synthetic backup injection in tests only, not through environment configuration. The runtime owns signal handling and drains its scheduled tick before closing the local service. Administrative alerts are bounded structured stderr records, not confirmation of external administrator delivery. Installation remains explicit: initialize a new private directory using native-storage-init.js, then configure GRUK_NATIVE_BACKUP_ROOT and GRUK_STORAGE_SIGNING_KEY_FILE from its output. Do not enable real backup or use customer data. External alert delivery, full installation verification on an independently durable volume, and production security approval remain open gates.

## Filesystem security review (development)

Archive reads reject nonregular files, group/world permissions, foreign ownership and multiple hard links. Source opens are nonblocking and reject final-component symbolic links. These controls assume a dedicated trusted OS account and private parent directories; they are not protection against a privileged or same-user attacker. Bearer tokens remain reusable within their short lifetime; loopback is not a tenant boundary. No production approval or independent security audit is claimed.
