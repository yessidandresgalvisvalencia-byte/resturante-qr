# GRUK Finanzas Personales — permisos del historial DecisionProof

## Alcance

La colección `DecisionProofPersonal` almacena comprobantes de decisiones, **no** todos los movimientos contables. Sus protecciones Mongoose son defensa en profundidad, no un control de seguridad de base de datos. El usuario de MongoDB con acceso directo aún puede eludirlas si tiene privilegios `update`, `remove`, `dropCollection` o `dropDatabase`.

## Comprobación segura (solo lectura)

Ejecutar **solo en el entorno personal autorizado**, con las variables `PERSONAL_MONGO_URI` y, si aplica, `PERSONAL_MONGO_DB` configuradas en el gestor de secretos:

```bash
npm run audit:personal:mongo-privileges
```

El comando consulta `connectionStatus` con `showPrivileges`. No imprime la URI, usuarios, contraseñas o tokens. Sale con código 1 si encuentra privilegios peligrosos o si no puede verificarlos. No cambia roles ni datos.

## Endurecimiento pendiente (requiere plan de migración)

1. Inventariar todas las colecciones del servicio personal y sus operaciones, incluidas las de autenticación, encabezado de cadena y outbox.
2. Usar una identidad MongoDB exclusiva para GRUK Finanzas Personales, sin `readWriteAnyDatabase`, `dbOwner`, `root` ni privilegios de administración. Evitar compartirla con GRUK Empresarial.
3. Diseñar un rol **personalizado** que conceda solo `find` e `insert` sobre la colección DecisionProof y las operaciones mínimas necesarias sobre las restantes colecciones. Para el encabezado de cadena, se necesita `update`; para el outbox, el publicador utiliza actualizaciones de estado.
4. Probar el nuevo usuario en staging con transacciones y pruebas de concurrencia antes de cambiar `PERSONAL_MONGO_URI`. Conservar un acceso administrativo separado para recuperación.
5. Repetir la auditoría con la identidad que realmente usa el servicio desplegado; no con el usuario administrador.

**Importante:** MongoDB concede acciones a nivel de colección, no prohíbe una operación sobre documentos particulares con un simple rol. Se necesitan controles adicionales contra alteración de encabezados, abuso de consultas nativas, restauraciones maliciosas, y borrado o reemplazo completo de la base. La comprobación de privilegios no es una garantía criptográfica de inmutabilidad. Para detectar reescrituras completas se requieren anclajes externos de hashes y backups inmutables.

**No aplicar cambios de roles automáticamente a producción** hasta contar con una identidad personal segregada y pruebas de regresión satisfactorias.
