# GRUK Storage — reproducible standby installation

Status: template only; no host provisioned or deployment authorized.

Use the reviewed repository revision and a dedicated non-root Linux account. Do not install on the existing ephemeral Render web service. The supplied systemd unit is for standby only, not the backup scheduler.

Before installation:
- Confirm ownership, actual independent physical failure domains, persistent mounts at /srv/gruk-storage/primary and /srv/gruk-storage/secondary, and adequate space. Device IDs alone do not establish independence.
- Use private directories owned by gruk-storage (0700); provision the local API key as a 32-byte file (0600), separately from AGE and Ed25519 keys. Do not overwrite existing files.
- Install the reviewed source at /opt/gruk-storage, root-owned and read-only to the service. Verify Node runtime and dependencies.
- Copy the standby environment template to /etc/gruk-storage/standby.env with restrictive permissions. Keep every real-operation flag false.
- Review the unit with systemd-analyze verify on the actual host. Confirm that its mount conditions and host preflight pass. Verify filesystem persistence across restart before using any data.
- Confirm systemd sandbox enforcement, loopback-only listener and no external network access. The IP filter is defense in depth; validate actual host support.
- Install/start the unit only after founder authorizes the host. Do not enable automatic startup until standby acceptance succeeds.

Acceptance: restart the service, inspect local health and synthetic filesystem evidence; verify that real backups remain blocked. No production database credentials are needed in standby. The unit has no external egress and cannot support real catalog recovery until a separately reviewed release changes the network policy. Never grant Docker socket access to this standby service.

No production certification is implied by the template. See native-storage-production-readiness.md for remaining release gates.

## Release evidence and acceptance record

The installation package consists of the reviewed Git revision, the service unit and environment example in deploy/gruk-storage, and the native host preflight script. Keep these together; do not copy an unreviewed unit from a different revision.

CI checks the installation safety directives and invokes systemd-analyze verify without installing or starting the unit. This is syntax validation only; mount persistence, isolation and network-filter enforcement require actual host tests.

Verified baseline: synthetic signed-replica MongoDB restoration at commit 0450af0c0962bdd4aede9b35903664cd312116a3, run 45887330561. Six automated workflows succeeded at commit 9dac65c67bea154decfa04c8a168ab782a00d67a. The independent catalog probe was intentionally skipped at that revision, not re-certified.

Before authorizing standby installation, record the exact commit and CI run, host ownership, service account, mount identifiers, available capacity, restart persistence evidence, actual failure-domain separation, systemd verification result and observed loopback-only listener. Record pass/fail and evidence for each gate; never include credentials or private keys. Missing evidence means BLOCKED, not PASS.

The package does not authorize any actual backup, restore, external connection, paid resource, or production deployment. The existing real-backup runtime block stays in force.
