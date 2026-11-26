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
