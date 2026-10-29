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

En ese mismo replica set autenticado, los servicios reales registran ingresos y gastos, corrigen y anulan mediante eventos compensatorios, reconstruyen el saldo y publican el outbox. Se comprueban reintentos sin duplicar caja, aislamiento entre usuarios, rechazo por saldo insuficiente, rollback ante fallo del outbox y conservación de los asientos originales. También se anexa, reintenta y anula un evento del ledger V81 conservando su cadena verificable. Estas pruebas utilizan la conexión restringida con DDL automático desactivado; no acreditan todas las rutas financieras ni las credenciales del despliegue real.

La confirmación de un intento manual compara primero la solicitud con el asiento original y reconstruye su estado compensado dentro de la misma instantánea MongoDB. Un original con compensación no se presenta como activo confirmado: devuelve `CORREGIDA` o `ANULADA`, con `confirmado: false`. La interfaz conserva la clave pendiente y pide revisar el historial. Una lectura que no pueda verificar la integridad falla sin confirmar el movimiento.

Antes de anexar una compensación, el registrador comprueba toda la cadena del usuario desde génesis y su coincidencia con el cursor dentro de la transacción. Un hueco o una alteración en otro movimiento también bloquean la escritura; no se reinicia un cursor ausente si ya existen eventos. CI simula estos daños con el administrador local y verifica que el usuario restringido no cambie fuentes, caja, eventos, cursor ni outbox. La consulta tiene timeout de cinco segundos y admite hasta 10.000 eventos: al alcanzar ese límite no se añade otro que las lecturas de transición no puedan verificar. Esta revisión O(n) no sustituye anclajes independientes ni demuestra resistencia ante una reescritura coherente por un administrador.

Las correcciones/anulaciones de caja y las reversiones de cuotas de compras y préstamos comparten esa lectura verificada antes de devolver un reintento exitoso. Un recibo intacto no oculta una cadena truncada en otro movimiento ni un cursor alterado. Un reintento válido conserva el evento y evita duplicar sus efectos financieros; puede avanzar la revisión interna del control de concurrencia. El límite de 10.000 eventos permite verificar recibos existentes, aunque impide añadir nuevos eventos hasta ampliar la capacidad.

La aprobación conversacional de ingresos y gastos inserta el ID de la cuenta EFECTIVO junto al asiento y ajusta su saldo con el predicado de enteros seguros, dentro de la misma transacción que el borrador y el outbox. CI con rol restringido comprueba su posterior corrección/anulación sin modificar fuentes, aislamiento entre usuarios, rechazo de fracciones/desbordamientos y rollback de un lote completo por saldo insuficiente. Los tipos patrimoniales genéricos sin una obligación identificada se rechazan y requieren el flujo específico de préstamos; las ramas conversacionales se verifican por separado según los casos descritos a continuación.

Los cobros conversacionales identifican una única obligación activa del usuario, insertan sus IDs de préstamo y cuenta, y confirman saldo pendiente, entrada de caja, borrador y outbox en una misma transacción. Un origen confirmado como TRABAJO registra INGRESO; los demás conservan COBRO_PRESTAMO. CI prueba abonos parciales, pago completo, concurrencia sin sobrecobro, reclasificación posterior sin duplicar caja y rollback por ambigüedad, deuda ajena, exceso, fecha futura, desbordamiento o fallo del outbox. No se completan vínculos de cobros históricos ni se acredita su conciliación retroactiva.

Las transferencias y aportes a ahorro conversacionales validan cuentas propias activas en COP y saldos enteros seguros. Ambas actualizaciones, el borrador y el outbox se confirman o revierten juntos; las cuentas quedan con conciliación pendiente. El evento usa `aggregateType: TRANSFERENCIA_PROPIA`, incluye IDs y saldos posteriores de ambas cuentas y permite rechazar conciliaciones anteriores a la ejecución del traspaso. CI verifica conservación del total con BigInt, concurrencia y rollback por saldo insuficiente, desbordamiento, datos inconsistentes o fallo del outbox. El traspaso no genera ingresos/gastos ni se convierte en saldo bancario verificado; el outbox sigue siendo una proyección mutable, sin custodia independiente.

## Provisión separada y arranque

El servidor abre la conexión con `autoCreate: false` y `autoIndex: false`. Antes de escuchar peticiones exige una política de privilegios compatible, los índices de seguridad V81 y los índices únicos del registrador compensatorio. Si la comprobación falla, cierra Socket.IO y MongoDB. `/healthz` permanece condicionado a conexión, privilegios e índices verificados.

La auditoría de índices V81 exige las claves en el orden declarado y rechaza índices únicos `sparse`, TTL o con collation distinta de `simple`. Las reservas y vínculos requieren cobertura completa; la idempotencia transaccional admite únicamente el filtro `{ externalIdHash: { $type: "string" } }`, sin condiciones adicionales. Un índice único oculto sigue imponiendo unicidad. Los índices de consulta parciales, sparse u ocultos se informan como no verificados para rendimiento, sin bloquear por sí solos el arranque. Esta comprobación de metadatos no demuestra la configuración de producción ni la completitud de sus datos.

El registro idempotente, las reservas recurrentes y el registrador compensatorio reutilizan esa comprobación estricta antes de escribir. CI sustituye índices reales por un filtro adicional, un índice sparse y una collation no binaria: las operaciones con el usuario restringido responden 503 sin modificar fuentes, saldo, eventos, cursor ni outbox; tras restaurarlos, la compensación se confirma. La comprobación previa no bloquea cambios administrativos concurrentes entre la revisión del índice y la escritura; no acredita protección contra una credencial administrativa hostil.

La provisión se ejecuta separadamente con una credencial administrativa en `PERSONAL_MONGO_PROVISION_URI` y una base explícita en `PERSONAL_MONGO_DB`. No se reutiliza `PERSONAL_MONGO_URI`. El comando es:

```sh
npm run provision:personal:mongo -- --apply
```

El manifiesto carga exclusivamente los modelos de `modules/finanzas-personales/models/`. Crea sus colecciones e índices declarados, sin modificar documentos ni retirar índices. Repetir la misma definición es idempotente. Los conflictos se propagan; una provisión interrumpida puede haber creado parte de las colecciones o índices anteriores al fallo. No ejecuta `syncIndexes` ni concede roles.

La prueba con autorización activada provisiona primero con una cuenta administrativa local y después arranca el servidor real con el usuario restringido. Comprueba salud HTTP 200, DDL automático desactivado, rechazo de un perfil `readWrite` y rechazo de un índice compensatorio ausente. Los servicios auxiliares externos se sustituyen únicamente dentro del proceso de prueba.

No aplicar roles de producción ni retirar permisos de una conexión existente a partir de este informe solamente. Todavía deben comprobarse las credenciales y rutas de escritura del despliegue real, los índices existentes, sus datos y la custodia independiente de anclas.

El bloqueo de liberación [#407](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407) sigue abierto. El informe no cambia la decisión de `gruk-personal-ledger-mutability-audit.js --enforce` ni autoriza un despliegue.

Referencias del contrato MongoDB: [connectionStatus](https://www.mongodb.com/docs/manual/reference/command/connectionStatus/) y [documentos de recursos](https://www.mongodb.com/docs/manual/reference/resource-document/).

Los ajustes conversacionales de EFECTIVO y AHORRO reutilizan la conciliación de cuentas con una sesión externa activa. El saldo, su ancla de origen USUARIO, el borrador, el outbox y el asiento de ajuste (sin efecto de caja) se confirman o revierten juntos. Se rechazan fechas futuras, anclas iguales o posteriores y movimientos, compensaciones o transferencias posteriores a la declaración. Las nuevas declaraciones actuales conservan la hora de captura; las referencias a ayer o mañana mantienen su fecha relativa. CI prueba el rechazo de sobrescrituras y el rollback de auditoría y lotes. Un saldo declarado por el usuario no acredita saldo bancario ni custodia independiente.

El análisis de progreso económico consulta el estado compensado y usa BigInt para sumas, brechas y comparación del umbral de gasto hormiga, rechazando resultados fuera de rango. Actualiza importes únicamente en acciones PROPUESTA y muestra solo propuestas cuya condición sigue vigente; las acciones APROBADA conservan su línea base. CI con rol restringido comprueba correcciones, anulaciones, aislamiento y ese ciclo de propuestas. El análisis combina lecturas del panel y las obligaciones; no constituye una instantánea transaccional única de todos los indicadores; la validación de evidencia al completar acciones se comprueba por separado.

Completar una acción de progreso consulta el estado compensado de su evidencia dentro de una transacción y comparte el control de escritura con las compensaciones. Rechaza evidencias ajenas, anuladas, futuras, incompatibles o cuyo importe vigente sea inferior al resultado declarado. Un ingreso de trabajo puede respaldar COBRO si identifica una cuenta por cobrar del usuario. Acción y outbox se confirman juntos; la auditoría conserva tipo, importe, fecha y hash compensatorio usados en ese instante. Una compensación posterior no reabre automáticamente la acción completada: la evidencia registrada es histórica, sin certificación bancaria ni custodia independiente.

La creación conversacional de deudas valida capital, saldo, cuota y abonos como enteros seguros; exige saldo no superior al capital y coherencia del abono declarado. Un saldo cero se registra PAGADO y una tasa ausente permanece sin confirmar. El concepto Moto o Vehículo no genera automáticamente un activo valorado con el capital prestado. CI comprueba estas condiciones y rollback de auditoría con rol restringido; no corrige deudas ni activos históricos creados previamente.

Las deudas conversacionales sin día de pago explícito conservan vencimiento y periodicidad pendientes. Cuando se indica un día, se persiste el calendario mensual; su confirmación requiere además una cuota positiva exacta. El próximo vencimiento se calcula por día civil de Colombia, conserva el vencimiento de hoy y ajusta días inexistentes al final del mes. No se actualizan calendarios históricos ni se infieren intereses o plazos de amortización.

TransaccionPersonal rechaza por middleware las actualizaciones, reemplazos, borrados, bulkWrite y save de documentos existentes. La creación de asientos nuevos sigue permitida. Pruebas sin conexión verifican el bloqueo del modelo y CI conserva los flujos financieros con MongoDB real. Las simulaciones de corrupción y la limpieza de pruebas usan el driver nativo explícitamente; ese acceso puede eludir middleware y depende de los permisos de MongoDB. Esta defensa no sustituye el rol restringido ni certifica inmutabilidad completa.

La búsqueda de mutaciones recorre recursivamente los archivos JavaScript regulares del módulo personal y reconoce importaciones CommonJS de los cinco modelos protegidos, ciertos aliases, accesos inline y escrituras nativas con colección literal. Las pruebas verifican archivos anidados y distinguen modelos mutables ajenos al historial. Es heurística: no resuelve scopes, documentos, aliases dinámicos, ESM ni procesos externos; comentarios y cadenas pueden producir candidatos. Un resultado vacío no cierra #407 y --enforce conserva salida 1.

La auditoría incluye además archivos JavaScript de la raíz y los directorios scripts, routes y controllers del repositorio. Solo señala operaciones sobre los modelos/colecciones personales protegidos reconocidos, sin tratar las cuentas mutables como historial inmutable. No ejecuta scripts ni modifica datos; las importaciones indirectas, otros directorios y procesos externos siguen requiriendo revisión.

Mongoose también permite desactivar middleware mediante opciones explícitas. La protección de hooks no es una frontera de autorización: CI con rol restringido intenta updateOne, deleteOne y bulkWrite con middleware desactivado, además de updateOne sobre un documento cargado, y exige el rechazo real de MongoDB (código 13), conservando las fuentes. No retirar los controles de base de datos por tener pruebas de hooks verdes.

El verificador `security/anclaCompensacionesPersonal.service.js` acepta compromisos Ed25519 para el dominio exclusivo `GRUK_COMPENSACIONES_PERSONALES_V1`. Usa únicamente una clave pública confiable proporcionada por el llamador; no firma, almacena, publica ni obtiene anclas. El cuerpo firmado contiene versión, dominio, algoritmo, usuario, secuencia, hash de cabeza y fecha ISO canónica; la firma se codifica en Base64 canónico. La lectura debe proceder de una instantánea del servidor con eventos lean sin `_id`, y cursor del mismo usuario. Se verifican cadena completa, semántica compensatoria y coincidencia del prefijo anclado, hasta 10.000 eventos.

Un resultado `ANCLA_VERIFICADA` solo acredita esa comparación criptográfica: `certificaCustodiaIndependiente` permanece false. No valida saldos ni fuentes originales. La clave privada debe permanecer fuera de la aplicación; siguen pendientes el custodio, autenticación, retención, rotación de claves y entrega confiable del último compromiso sin retrocesos. Un ancla antigua no detecta por sí sola la pérdida de eventos posteriores a su secuencia. El verificador no se conecta a rutas ni modifica el gate --enforce; #407 permanece abierto.

El servicio auditoriaAnclaCompensacionesPersonal obtiene una referencia mediante un adaptador confiable del servidor y lee eventos y cursor en una transacción snapshot, sin escrituras. El adaptador recibe usuario, dominio y AbortSignal; hay plazo de cinco segundos y los errores del proveedor se reducen a códigos estables. CI usa un custodio simulado con claves efímeras, MongoDB autenticado y rol restringido para comprobar ausencia de cambios y detección de truncamiento incluso con cursor coherente. El adaptador de producción, la autenticación, la retención y la garantía de referencia más reciente siguen sin configurar; no hay ruta HTTP ni custodia independiente acreditada.
