# P0-04 — Auditoría monetaria de datos históricos (solo lectura)

## Alcance y separación
Esta auditoría es exclusivamente para la **base de GRUK Empresarial**, y no modifica registros. El script `scripts/gruk/p0-04-money-readonly-preflight.js` inspecciona los campos monetarios en `ventas`, `movimientos_caja`, `cuentas_tesoreria`, `transferencias_tesoreria`, `compras` y `gastos`. No incluye Finanzas Personales ni Blushea. El operador debe confirmar independientemente el nombre real de la base, el URI y la cuenta usada. Los nombres en variables no prueban que se esté conectado al servidor correcto.

## Procedimiento autorizado
1. Una persona con autorización de base de datos confirma primero en el proveedor Mongo/Render el clúster, URI, nombre exacto de la base GRUK Empresarial, permisos de **solo lectura** y plan de respaldo. No copie credenciales a un commit o a un chat.
2. Ejecute en un entorno seguro con `mongosh` y una credencial limitada a lectura:

```sh
export GRUK_ENTERPRISE_DB="NOMBRE_VERIFICADO_BASE_EMPRESARIAL"
export GRUK_ENTERPRISE_DB_CONFIRM="$GRUK_ENTERPRISE_DB"
export GRUK_MONEY_AUDIT_READONLY="CONFIRMO_SOLO_LECTURA"
mongosh "$GRUK_ENTERPRISE_MONGO_URI" --quiet \
  --file scripts/gruk/p0-04-money-readonly-preflight.js
```

3. Guarde el resultado sin identificadores de clientes. La salida muestra solo recuentos por campo, además de las colecciones ausentes. La herramienta **no ejecuta INSERT, UPDATE, DELETE, dropIndex ni createIndex**. Nunca le proporcione credenciales de escritura.
4. Cualquier `invalidType`, `nonCent`, `outOfRange`, `conversionFailures` o `missingRequired` bloquea la evaluación de aptitud. `missingOrNull` de campos históricamente opcionales se reporta, pero no se corrige ni invalida automáticamente. Si faltan colecciones, revise si son esperadas para esa instalación.
5. Una salida `monetaryDataReadyForDbaReview: true` significa exclusivamente que la auditoría terminó sin anomalías de estas reglas. **No certifica migración segura, equivalencia contable ni cumplimiento DIAN**. Revise manualmente transacciones, referencias, respaldos, restauración ensayada e índices.

## Límites y siguiente fase
Los tipos de almacenamiento existentes incluyen `Number`; la auditoría no los transforma en `Decimal128` ni cambia los esquemas. La exactitud de `Number` histórico no puede inferirse solo por tener dos decimales visibles. Para migrar a tipos exactos se necesita diseño versionado, respaldo recuperable, comprobación de totales por empresa/sede, dual-read/dual-write o congelamiento controlado, verificación de diferencia igual a cero, ventanas de mantenimiento, observabilidad y rollback aprobado por DBA.

**Estado al 19 de noviembre de 2026:** implementado en PR #610, pendiente ejecución autorizada sobre la base real empresarial, revisión independiente, prueba de restauración y despliegue de producción. Los tests con bases desechables no sustituyen estas operaciones.
