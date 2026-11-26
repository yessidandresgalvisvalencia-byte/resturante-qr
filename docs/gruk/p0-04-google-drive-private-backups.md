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
