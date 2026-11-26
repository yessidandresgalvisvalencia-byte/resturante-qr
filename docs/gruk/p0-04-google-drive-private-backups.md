# GRUK Empresarial — respaldo cifrado a la carpeta privada de Google Drive

## Destino real creado y verificado

- Carpeta matriz privada: https://drive.google.com/drive/folders/1kI7r6ImpE7V-C8u7swDaorffdKz6w1NN
- Carpeta **01_RESPALDOS_CIFRADOS**: https://drive.google.com/drive/folders/1_1OxE9Ey7kr-GoCjOnC_Elm_sJpTQrfN
- Carpeta **02_VERIFICACIONES_Y_RESTAURACION**: https://drive.google.com/drive/folders/1ZUNjn4XHhH7RB_pvqUO37EMBGI2VUlF7
- Carpeta **03_MANIFIESTOS_SIN_DATOS_PERSONALES**: https://drive.google.com/drive/folders/1CfZhbOqDNu7SRgYHrO8LwF5Pu9v9y5F0

El propietario es el único usuario con permisos en la carpeta principal (verificación de metadatos 20/11/2026). **No existen respaldos reales verificados por el solo hecho de crear una carpeta.**

## Qué hace el nuevo flujo

`.github/workflows/gruk-p004-google-drive-encrypted-backup.yml` ejecuta en cada PR un test sin datos reales. La operación REAL está desactivada por defecto y solo puede dispararse mediante `workflow_dispatch`, validación de base exacta y confirmación expresa.

1. Lee la base empresarial **`restaurante`** con credenciales MongoDB exclusivas de lectura. No toca Finanzas Personales.
2. Ejecuta `mongodump --db=restaurante --archive --gzip` y cifra el stream en el runner con `age` antes de guardar o subir cualquier archivo.
3. Usa un cliente OAuth propio de Google Drive con `refresh_token` para subir únicamente un objeto `.archive.age` a la carpeta privada exacta; GitHub **no hereda** la autorización del conector de ChatGPT.
4. Descarga la copia cifrada por ID, valida tamaño y SHA-256, y descifra temporalmente solo para `mongorestore` en Docker `--network none`. El destino es `restaurante_restore_drill`, nunca Atlas.
5. Compara nombres, recuentos de documentos e índices con la base de origen. El resultado exitoso se registra en GitHub Actions sin volcar secretos ni información personal.

## Configuración necesaria (todavía no confirmada)

Para automatizar desde GitHub se necesita una autorización OAuth de Google Drive separada de la conexión de ChatGPT, con alcance apropiado para escribir y leer la carpeta seleccionada y permisos mínimos. Crear en Google Cloud un cliente OAuth, habilitar Drive API y autorizar un `refresh_token` propio del usuario para esta aplicación. Preferir alcance restringido `drive.file` junto con selección explícita de carpeta mediante Picker; si el flujo de autorización no otorga acceso a una carpeta preexistente, se necesitará un mecanismo de selección autorizado. No conceder acceso global por defecto.

Guardar como secretos del entorno protegido `gruk-enterprise-real-backup`:
- `GRUK_DRIVE_OAUTH_CLIENT_ID`, `GRUK_DRIVE_OAUTH_CLIENT_SECRET`, `GRUK_DRIVE_OAUTH_REFRESH_TOKEN`
- `GRUK_BACKUP_AGE_RECIPIENT` (clave pública), `GRUK_BACKUP_AGE_IDENTITY` (identidad privada de descifrado para el ensayo, con copia de emergencia **cifrada y custodiada fuera de GitHub/Drive**)
- `GRUK_ENTERPRISE_READONLY_MONGO_URI`, con permiso exclusivo para leer `restaurante` y credencial rotada según política.

El ID de la carpeta cifrada es fijo en el workflow; no es un secreto. Configurar *required reviewers* en el entorno protegido y la menor duración posible de las credenciales. Nunca publicar claves privadas ni tokens en issues, repositorios, Drive, logs o chat.

## Limitaciones y aceptación

- No programar cron real ni eliminar índices hasta que funcione una primera copia/restore y un encargado apruebe retención y custodia de claves.
- **Un test de contrato verde no significa backup real ejecutado**. Solo si el job real registra `GRUK_DRIVE_BACKUP_REAL_RESTORE_OK` con el objeto remoto recuperado podrá hablarse de restauración técnica comprobada.
- El comparador de índices/conteos podría fallar si la base sigue cambiando durante el backup. Acordar ventana de baja actividad o implementar método de snapshot consistente antes de certificar los balances.
- La prueba de conteos/índices no valida por sí sola todos los hashes de documentos, importes por sede, RPO/RTO, frecuencia ni recuperación ante la pérdida simultánea de Google y GitHub.
- El plan maestro exige un respaldo recuperable y trazabilidad **antes** de retirar un índice único global heredado o declarar el producto listo para cobros reales.

**Estado a 20/11/2026:** estructura privada creada; código de transporte y ensayo construido; autorizaciones OAuth propias de GitHub, ejecución con datos reales y validación integral **pendientes**.

## Cloud-only phase 2: quota preflight

Before creating a resumable upload, query Drive storageQuota and refuse missing or invalid quota, insufficient space, or an archive larger than 1 GiB. Reserve 100 MiB by default. Reject nonregular source files and invalid AGE headers before authentication. Header inspection is not cryptographic verification; the existing isolated restore remains mandatory. This preflight is not a billing guarantee or atomic quota reservation and assumes a dedicated trusted runner and stable source file. No automatic deletion, new provider account, real data upload or production activation is authorized by this change.

Cloud download now stages files privately, enforces provider-declared length and MD5 before publication, validates the AGE header and refuses overwrite. MD5 is a transport consistency check only, not a security proof; the independently computed SHA-256 and AGE authenticated decryption in the restore workflow remain mandatory. Redirects are rejected and no raw remote errors are logged.

The restore workflow creates a versioned SHA-256 manifest before uploading and verifies downloaded ciphertext against that local reference before isolated restore. The manifest binds database scope, archive name, byte count and digest. This is an independent reference relative to remote metadata, but temporary runner custody is not durable independent storage or a signed receipt. A separate authenticated manifest destination remains a release gate. No real execution is authorized by this change.

## Signed manifest contract (development only)

Ed25519 receipts bind the canonical enterprise manifest to an explicit key fingerprint and domain-separated signature. Verification requires a separately trusted public key and expected archive name, never a key supplied by the receipt. Synthetic tests use ephemeral keys. This module is not yet wired into the real backup workflow; durable independent custody, key provisioning, rotation, and authorization remain pending. No production data or secrets are used.

## Signed receipt integration

The manual restore workflow now requires separately provisioned Ed25519 signing and pinned verification keys, checks the key pair before remote upload, and verifies the downloaded ciphertext against the signed receipt before restore. The verification subprocess receives no signing key. The receipt remains in the temporary private runner directory; independent durable custody and key rotation remain unimplemented. The manual production job stays disabled unless explicitly dispatched; do not dispatch until all gates are met. The contract job now includes synthetic tests for all drive helper modules.

## Key rotation contract (development)

A bounded trusted public-key registry distinguishes active, retired and revoked Ed25519 keys. Only the active key may sign; retired keys verify historical receipts, revoked keys fail closed. Registry entries are validated against their SPKI SHA-256 fingerprints. The registry must be provisioned through a trusted independent configuration channel; receipt-supplied keys are never trusted. This module is not yet integrated with the real workflow, and does not implement durable registry custody or automatic private-key rotation. Tests use synthetic ephemeral keys only.

## Keyring workflow integration

The manual workflow now requires GRUK_MANIFEST_TRUSTED_KEYRING (JSON with activeKeyId and keys entries containing keyId, status, publicKey) instead of the single trusted public key secret. The signing private key must match the active registry key. Historical receipts can be verified using retired keys; revoked keys fail closed. The shell unsets the signing key after receipt creation. Registry configuration and independent durable receipt custody remain release gates. No real workflow was dispatched.

## Independent catalog contract (development)

A provider-neutral catalog registers signed receipts through a create-only storage interface, reads them back and verifies the trusted signature on every lookup. It never asserts that restoration succeeded based on a receipt alone. The test uses an in-memory synthetic adapter. A durable independent cloud adapter with atomic conditional creation, credentials and retention is still required; this commit does not establish external custody or authorize real backups.

## Persistent catalog adapter (development)

The MongoDB adapter restricts storage to gruk_storage_catalog.signed_receipts, uses the unique _id for atomic create-only writes and requests journaled majority acknowledgement and majority reads. Tests use a simulated driver; provider support for these options and a separately provisioned deployment must be verified before activation. Database naming alone does not establish infrastructure independence. Use separate credentials with insert/find only, no update/delete privileges. No connection, account creation, billing change or real backup is performed by this module. A free independent deployment is a candidate, not a confirmed resource.

## Catalog connection preflight

The new connection boundary validates dedicated Atlas SRV endpoints, exact catalog database and independently configured hostname, rejects shared source hostname or username and unsafe URI options, and closes the injected connection on completion or failure. This intentionally supports Atlas SRV only; a different provider or source URI format requires an explicit reviewed adapter. Different hostnames do not prove independent infrastructure: verify cluster ownership, billing, credentials and failure domains separately. No real driver connection or workflow activation is included; tests use synthetic endpoints.

## Catalog runtime (development)

A disabled-by-default CLI connects the signed receipt, ciphertext verification and separate catalog adapter. Registration requires a valid local receipt and matching ciphertext, then performs create-only persistence and readback; verification checks the stored signed manifest against the ciphertext. The real workflow is not yet wired to the CLI. Production activation requires independently provisioned credentials, host verification, quota and approval. Synthetic tests inject a simulated connection; no live cloud access is performed.

## Mandatory catalog workflow gate

The manual real-data workflow now requires GRUK_CATALOG_ENABLED=true, a dedicated catalog URI secret and an independently pinned host variable. It validates connection configuration before querying the source, registers the signed ciphertext receipt before Drive upload and verifies the catalog against downloaded ciphertext before isolated restoration. The manual job installs locked Node dependencies. A registered receipt is not proof of successful upload or restoration; failed attempts may leave a receipt and require reconciliation, never overwrite. No infrastructure or production credentials have been provisioned and the manual job must remain disabled until explicit approval and real independent deployment validation.

## Read-only reconciliation contract

Classifies missing or untrusted catalog entries, unavailable remote inspection, unconfirmed uploads, duplicates, size mismatches and objects awaiting restore verification. Never deletes, overwrites, or retries uploads automatically. An injected inspector must return a complete exact-folder result set; a real Drive inspector and durable restore evidence remain pending. Metadata agreement alone never establishes restoration. Tests use synthetic adapters.

## Read-only Drive inspection adapter

The inspector queries only the exact private backup folder and archive name, checks folder identity, paginates bounded results, rejects incomplete search and unexpected objects, and exposes only reconciliation metadata. Tests inject a fake HTTP transport; no live OAuth call is performed. A separate runtime wiring and credential validation remain necessary. No uploads, deletes, billing changes or restoration certification occur.

## Reconciliation runtime and local alerts

The read-only CLI requires both GRUK_CATALOG_ENABLED and GRUK_RECONCILIATION_ENABLED, validates connection configuration, reads signed catalog entries, and uses OAuth solely to inspect the exact Drive archive. It emits sanitized local stderr warning events for anomalies and a nonzero exit status; external administrative delivery, scheduling, and production credentials remain unconfigured. Synthetic tests inject both network transports. The CLI is not invoked automatically and cannot certify restoration.

## Bounded reconciliation batch (development)

A sequential batch runner deduplicates archive names, aggregates alerts by status, limits each batch to ten inputs by default (maximum twenty), and blocks overlapping or too-frequent attempts within one process. The default interval is 24 hours. No timers, cron jobs, external notification delivery or live network calls are enabled by this module. State is process-local and does not survive restart; durable coordination and explicit scheduling authorization remain release gates. Synthetic tests cover throttling and alert failure.

## Persistent reconciliation coordination (development)

The dedicated reconciliation_control collection uses an atomic singleton reservation with majority journaled acknowledgement, an owner token and a completion-based cooldown. Interruptions retain the reservation deliberately; there is no automatic lease takeover. A reviewed operator recovery procedure, dedicated collection permissions, trusted clock, actual MongoDB concurrency tests and runtime integration remain required. Tests simulate driver semantics only. No scheduler or live connection is activated.

## Interrupted reservation recovery (development)

The recovery primitive requires explicit confirmation that the previous worker terminated, exact owner and start time, a reviewed incident evidence identifier, and at least one hour elapsed. It uses an atomic conditional update and imposes a new 24-hour cooldown. The operator must independently verify termination; elapsed time and the confirmation string are not proof. The singleton retains only the latest recovery metadata, not an immutable audit trail. No administrative CLI or live recovery is enabled. Runtime wiring and real MongoDB tests remain pending.

## Coordinated inspection integration (development)

The coordinated runner joins persistent reservation, bounded batch processing and read-only inspection, aggregating alerts once per batch. It requires three explicit activation flags and validates inputs before opening a connection. The reservation is kept on uncertain completion. The test covers disabled and occupied reservations; full successful end-to-end integration against a real database, immutable recovery audit, independent credentials and scheduling remain pending. No scheduler is installed.

## Append-only reconciliation audit adapter (development)

The audit adapter records bounded inspection and recovery event types using create-only inserts, deterministic event identifiers, majority journaled writes and verified readback. Exact retries are idempotent; conflicting evidence fails closed. This is application-level append-only behavior, not provider-enforced immutability. Dedicated insert/find privileges, independent retention, coordinator integration and real database tests remain required. No live audit records were written.

## Audit integration

Coordinated inspections now require verified audit events before inspection and before reservation release. The recovery primitive supports an injected audit sink for request and completion events; no administrative runtime is enabled. Recovery update and completion audit are separate writes: a failure after the update can leave a request without completion and must be reconciled manually. This is not transactional immutable evidence. Real permissions, concurrency tests and full recovery audit integration remain release gates.

## Atomic recovery transaction (development)

The new recovery primitive updates the reservation and inserts both audit events within one MongoDB transaction, using snapshot reads and majority journaled commit. Any failure aborts the transaction; there is no fallback to separate writes. The caller must supply a client and database from the same independent deployment and verify termination of the old worker. The legacy recovery helper remains available but must not be used for production administrative recovery. Tests simulate transaction rollback; actual replica-set integration, privilege validation and administrative wiring remain pending. No live recovery occurred.

## Administrative recovery entry point

The disabled-by-default drive-recovery-admin CLI invokes only the atomic recovery transaction, with separate administrator and worker usernames, a pinned catalog host, explicit operator confirmation and incident reference. No nontransactional fallback exists in this entry point. The older helper remains for legacy tests and must not be exposed to operators. Username separation is not proof of least privilege; provider roles, trusted worker termination evidence, real transaction validation and credentials must be verified before activation. No workflow, live recovery or infrastructure was activated.

## Isolated real replica-set integration

CI now includes a disposable MongoDB replica bound to loopback, with synthetic records only. Eight competing reservations must yield one winner; a duplicate audit identifier must roll back the administrative recovery, followed by a successful transaction. The real-data manual job depends on this check. No production credentials are used by the test. The test is not evidence of actual independent cloud provisioning. CI execution and results must be verified before release.

## One-shot inspection job entry point

The disabled-by-default job validates four activation flags and an explicit bounded JSON list of archive names, invokes the persistent coordinated runner, and returns sanitized metadata-match, anomaly or skipped outcomes. It never reports restore verification. This is a one-shot entry point suitable for a future reviewed scheduler, not an installed schedule. Archive discovery, notification delivery and independent live credentials remain pending. Synthetic tests cover invocation gates and exit classifications. No recurring execution has been enabled.

## Bounded catalog discovery

The read-only discovery adapter enumerates up to ten catalog identifiers using majority reads, a simple-collation indexed cursor and one lookahead record. Ordering is lexicographic, not chronological. It exposes identifiers only, not receipts; each discovered receipt still requires signature verification during inspection. Cursor persistence, wraparound policy and scheduler wiring remain pending. Tests use synthetic data; no real catalog access is enabled.

## Persistent discovery cursor

Opt-in discovery inside the exclusive reservation loads one bounded page using the stored cursor. The cursor advances atomically with the owner-conditional release only after all page items have been inspected and completion evidence written. At end of catalog the cursor resets to null for the next cycle; empty pages also reset it. Anomalies count as inspected, not restored, and are revisited on the next sweep. Failed or incomplete runs retain the reservation and old cursor. The standalone job still requires explicit names until discovery mode is wired into its entry point. Synthetic tests verify cursor semantics; real integration and scheduler activation remain pending.

## Automatic discovery job integration

The one-shot entry point now supports explicitly enabled discovery mode and rejects simultaneous manual archive input. The persistent coordinator selects the next page. Empty pages return NO_RECORDS, not metadata match or verified recovery. No cron is installed. Before scheduling, verify end-to-end discovery, quota, cloud credentials, alert delivery and explicit operational approval. The daily cooldown remains enforced by the coordinator.

## Controlled inspection workflow staging

A main-only manual workflow prepares the eventual recurring inspection entry point without installing a cron. It requires explicit confirmation, repository activation and the dedicated inspection environment; configure required reviewers and independently validate permissions before dispatch. Inspection-specific OAuth credentials must be read-only and scoped to the approved archive folder as far as provider capabilities permit. No signing private key or AGE decryption key is exposed. The workflow has an eight-minute timeout and a persistent daily cooldown. No schedule, dispatch, environment creation or credential change was performed. Actual CI quota and end-to-end validation must be reviewed before activation; interruption can retain a reservation for manual recovery.

## End-to-end inspection release check

The isolated replica integration now exercises the actual one-shot job, signed synthetic receipts, two discovery pages, cursor reset, persistent cooldown, audit events and missing-object alerts. The Drive and OAuth responses are injected mocks; no external network calls or customer data are used. This strengthens release evidence but does not establish real cloud access, redundancy or restoration. Verify the CI result before proceeding with live configuration.
