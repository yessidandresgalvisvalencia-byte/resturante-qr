# Auditoría de privilegios del historial personal

`npm run audit:personal:mongo-privileges` consulta una sola vez `connectionStatus` con `showPrivileges: true`. Requiere `PERSONAL_MONGO_URI` y, si corresponde, `PERSONAL_MONGO_DB` configuradas en el entorno. El comando no modifica usuarios, roles, índices, colecciones ni documentos; tampoco imprime la URI, las identidades autenticadas ni sus roles.

La auditoría cubre los nombres reales de las colecciones de estos modelos:

| Modelo | Datos protegidos |
| --- | --- |
| TransaccionPersonal | Asientos originales |
| EventoCompensatorioPersonal | Correcciones y reversiones |
| DecisionProofPersonal | Pruebas de decisión |
| FinEventoV81 | Eventos del ledger V81 |
| VinculoHistoricoV81 | Evidencia de vinculación histórica |

Cada colección requiere permisos efectivos `find`, `insert` y `listIndexes`. Los privilegios de actualización o eliminación del outbox, cuentas y cursores se evalúan separadamente: no autorizan modificar el historial. Los permisos heredados mediante recursos de base completa o de todas las bases también se revisan. Las capacidades de administración de roles y las acciones desconocidas se rechazan conservadoramente.

El resultado tiene `compatible`, un código y los permisos faltantes o no permitidos por colección. El proceso termina con código 1 si la política no es compatible o la respuesta no se puede verificar. La auditoría anterior, limitada a DecisionProof, permanece disponible para sus consumidores existentes; el CLI ahora revisa las cinco colecciones.

## Alcance de la evidencia

`compatible: true` indica compatibilidad con esta política de privilegios efectivos. **No certifica inmutabilidad**: `certificaInmutabilidad` siempre es `false`. La consulta no acredita que el servidor tenga autorización activada, que no existan otras credenciales privilegiadas, ni que las anclas estén custodiadas por un servicio independiente.

En CI, un contenedor independiente con autorización habilitada comprueba que un usuario restringido puede insertar y consultar, pero MongoDB rechaza realmente actualizaciones, reemplazos, eliminaciones y DDL sobre las cinco colecciones. La prueba también confirma que las proyecciones mutables pueden actualizarse y que los perfiles `readWrite`, administrador y solo lectura no pasan la política. Esta evidencia pertenece exclusivamente al entorno de pruebas.

## Provisión separada y arranque

El servidor abre la conexión con `autoCreate: false` y `autoIndex: false`. Antes de escuchar peticiones exige una política de privilegios compatible, los índices de seguridad V81 y los índices únicos del registrador compensatorio. Si la comprobación falla, cierra Socket.IO y MongoDB. `/healthz` permanece condicionado a conexión, privilegios e índices verificados.

La auditoría de índices V81 exige las claves en el orden declarado y rechaza índices únicos `sparse`, TTL o con collation distinta de `simple`. Las reservas y vínculos requieren cobertura completa; la idempotencia transaccional admite únicamente el filtro `{ externalIdHash: { $type: "string" } }`, sin condiciones adicionales. Un índice único oculto sigue imponiendo unicidad. Los índices de consulta parciales, sparse u ocultos se informan como no verificados para rendimiento, sin bloquear por sí solos el arranque. Esta comprobación de metadatos no demuestra la configuración de producción ni la completitud de sus datos.

La provisión se ejecuta separadamente con una credencial administrativa en `PERSONAL_MONGO_PROVISION_URI` y una base explícita en `PERSONAL_MONGO_DB`. No se reutiliza `PERSONAL_MONGO_URI`. El comando es:

```sh
npm run provision:personal:mongo -- --apply
```

El manifiesto carga exclusivamente los modelos de `modules/finanzas-personales/models/`. Crea sus colecciones e índices declarados, sin modificar documentos ni retirar índices. Repetir la misma definición es idempotente. Los conflictos se propagan; una provisión interrumpida puede haber creado parte de las colecciones o índices anteriores al fallo. No ejecuta `syncIndexes` ni concede roles.

La prueba con autorización activada provisiona primero con una cuenta administrativa local y después arranca el servidor real con el usuario restringido. Comprueba salud HTTP 200, DDL automático desactivado, rechazo de un perfil `readWrite` y rechazo de un índice compensatorio ausente. Los servicios auxiliares externos se sustituyen únicamente dentro del proceso de prueba.

No aplicar roles de producción ni retirar permisos de una conexión existente a partir de este informe solamente. Todavía deben comprobarse las credenciales y rutas de escritura del despliegue real, los índices existentes, sus datos y la custodia independiente de anclas.

El bloqueo de liberación [#407](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407) sigue abierto. El informe no cambia la decisión de `gruk-personal-ledger-mutability-audit.js --enforce` ni autoriza un despliegue.

Referencias del contrato MongoDB: [connectionStatus](https://www.mongodb.com/docs/manual/reference/command/connectionStatus/) y [documentos de recursos](https://www.mongodb.com/docs/manual/reference/resource-document/).
