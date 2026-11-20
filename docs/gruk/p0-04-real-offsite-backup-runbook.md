# GRUK P0-04 — copias reales cifradas y ensayo de recuperación

Estado inicial: **NO CERTIFICADO**. La prueba anterior `p0-04-disposable-backup-restore-rehearsal.sh` solamente restauró datos sintéticos. Las 16 ventas corregidas tienen diario interno, **no** backup fuera de Atlas.

## Implementación

- `.github/workflows/gruk-p004-real-offsite-backup.yml` ejecuta una copia **solo por aprobación manual**; no se dispara el backup real en cada push, y nunca exporta datos a artefactos públicos.
- La única fuente es `GRUK_ENTERPRISE_READONLY_MONGO_URI`, apuntando a la base `restaurante`. El script llama `mongodump --db=restaurante --archive --gzip`, sin exportar `gruk_finanzas_personales` ni otras bases.
- El volcado se cifra con `age` **antes** de escribirse en disco. Se guarda en un bucket S3 privado con versionado activado y claves AWS limitadas a ese bucket.
- Se descarga otra vez desde S3, se compara el SHA-256 del cifrado, se descifra **solo dentro del runner temporal** y se restaura en Docker MongoDB aislado mediante `--network none`, base `restaurante_restore_drill`. Nunca se usa `--drop` o el URI de producción para restaurar.
- La prueba compara recuentos por colección y las especificaciones de índices. Si existen escrituras concurrentes durante la exportación, puede fallar la comparación: ejecutar durante una ventana de baja actividad o acceso de solo lectura consistente a nivel de aplicación.

## Configuración que todavía falta

Crear el entorno GitHub `gruk-enterprise-real-backup` con aprobación de responsable y secretos restringidos. El propietario del negocio debe aprobar un **bucket S3 privado con versionado y ciclo de retención**, una clave age cuya identidad privada se conserve **además fuera de GitHub**, y el acceso IAM mínimo al bucket.

Se requieren los secretos `GRUK_BACKUP_S3_BUCKET`, `GRUK_BACKUP_AGE_RECIPIENT`, `GRUK_BACKUP_AGE_IDENTITY`, `GRUK_BACKUP_AWS_ACCESS_KEY_ID`, `GRUK_BACKUP_AWS_SECRET_ACCESS_KEY`, `GRUK_BACKUP_AWS_REGION`. El secreto de Atlas de **solo lectura** ya configurado debe continuar siendo válido.

No pegar secretos en issues, PR, logs o esta conversación. El runner necesita salida hacia AWS S3, el cluster Mongo y repositorios de paquetes. En S3 habilitar cifrado del lado del servidor, bloqueo público, versiones y una política de expiración que cumpla la retención aprobada. Mantener la identidad privada age bajo custodia recuperable independiente.

## Pasos de certificación (no ejecutados en Atlas aún)

1. Despachar `GRUK P0-04 Encrypted Offsite Backup and Isolated Restore` con `database_name=restaurante` y `confirmation=RESPALDAR_SOLO_RESTAURANTE`.
2. Comprobar `GRUK_BACKUP_REAL_RESTORE_OK` en la ejecución, identificador de objeto versionado y recibo de almacenamiento, preservando hashes sin exponer datos.
3. Restaurar adicionalmente en un entorno aislado persistente de recuperación y verificar **saldos contables por empresa y sede**, referencias, y funcionamiento de la aplicación con esos datos. El test automatizado actual compara documentos por conteos/índices, pero **no acredita por sí solo integridad de todos los valores de los documentos ni RPO/RTO**.
4. Documentar custodia de claves, responsable, política de retención, tiempo de recuperación, alerta de fallo y una nueva prueba mensual.
5. Solo tras aprobación DBA, decidir si se retira el índice global heredado. **No eliminar índices automáticamente**.

**Resultado operativo:** hay un procedimiento real implementado y sometido a pruebas estáticas, pero no existe evidencia de respaldo real externo certificado hasta que el trabajo manual autorizado lo ejecute con almacenamiento y claves válidas.
