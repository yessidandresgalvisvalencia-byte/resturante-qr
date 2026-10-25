# GRUK Finanzas Personales
Producto desacoplado del ERP empresarial. La propiedad de datos se resuelve exclusivamente por userId; no comparte empresaId ni colecciones financieras empresariales.

API inicial:
- POST /api/finanzas-personales/movimientos
- GET /api/finanzas-personales/resumen
- GET /api/finanzas-personales/analisis
- POST /api/finanzas-personales/creditos/simular

Las futuras integraciones bancarias deben exigir consentimiento explícito, webhooks idempotentes y gestión segura de secretos. Nunca almacenar credenciales bancarias del usuario.

## Ledger V81 (rama de desarrollo; no desplegado)

Las rutas del ledger V81 están protegidas por `personalAuth` y `entitlement` (JWT personal verificado y sesión vigente). No se admite elegir `usuarioId` mediante el cuerpo de la solicitud.

- `GET /api/finanzas-personales/v81/integridad`: verificación de cadena del usuario autenticado. Responde `SIN_INICIALIZAR`, `SIN_MOVIMIENTOS`, `VERIFICADA` o `FALLIDA`.
- `POST /api/finanzas-personales/v81/movimientos`: registra un ingreso o gasto inmutable. JSON permitido: `{"id":"registro_0001","tipo":"GASTO","montoCop":"25000.30","fechaContable":"2026-01-01","timestamp":"2026-01-01T10:00:00-05:00"}`. El monto va como **texto decimal**, nunca un número de coma flotante. `id` debe ser estable entre reintentos.
- La primera escritura requiere una instancia de MongoDB configurada como replica set por el uso de transacciones. Fallos de clave única y concurrencia se presentan como conflictos; el cliente debe reintentar con el **mismo** identificador, no crear otro.

**Aislamiento:** el controlador extrae la identidad de `req.personalAuth`; el servicio de persistencia filtra por `usuarioId` en todas sus lecturas/escrituras. Las pruebas de integración del commit `d2cd416` confirmaron que dos solicitudes simultáneas con el mismo `id` crean un único evento en MongoDB aislado. No equivale a una auditoría externa ni autoriza todavía un despliegue.

**Limitaciones pendientes:** autenticación de extremos HTTP con token real y revocación bajo carga, rate limiting específico de escrituras V81, conciliación contra el libro personal existente, monitoreo, copias de seguridad y ejercicios de recuperación. Este ledger no se incorpora automáticamente al saldo de caja existente.

## Limitador de escrituras V81 — requisitos de producción

En `NODE_ENV=production`, la ruta `POST /api/finanzas-personales/v81/movimientos` exige `GRUK_V81_RATE_LIMIT_MODE=redis` y un cliente Redis listo e inyectado en `app.locals.redisV81`. Si falta cualquiera, responde `503` y no escribe movimientos. El modo local queda reservado para desarrollo y pruebas: **no** asegura una cuota global entre servidores. El cliente debe inicializarse con `iniciarRedisV81(app,{crearCliente})` usando `GRUK_V81_REDIS_URL` con esquema `rediss://` (TLS en producción). El proyecto compartido todavía **no** incorpora una dependencia concreta de Redis ni llama ese inicializador en `app.js`: no activar el modo distribuido en producción hasta implementar y verificar ambos pasos.

## Prueba de concurrencia V81 con MongoDB real (aislada)

Se añadió `test/gruk/ledger-v81-mongo-idempotencia-real.test.js` para comprobar en un replica set de **pruebas** que dos altas simultáneas con la misma clave no generan dos eventos, que un replay con importe modificado da conflicto y que un identificador igual entre usuarios mantiene el aislamiento.

- Requiere `GRUK_V81_TEST_MONGO_URI` con el **nombre de la base de datos dentro de la URL** empezando por `gruk_v81_test_`, por ejemplo `mongodb://127.0.0.1:27017/gruk_v81_test_integracion?replicaSet=rs0`.
- Nunca ejecutarla con `NODE_ENV=production`. El test exige un servidor de loopback (`127.0.0.1` o `localhost`), base de pruebas explícita, protocolo `mongodb://`, `replicaSet` y ausencia de credenciales en la URI. Sin estos requisitos la suite general marca la integración como **omitida**, lo que NO constituye validación.
- Ejecutar `npm run test:personal:mongo-idempotencia` tras levantar el replica set local y configurar su URI. **Este comando exige la URI antes de ejecutar** y falla con código distinto de cero si no se proporcionó una instancia de pruebas válida. Para CI, usar un servicio MongoDB efímero dedicado y revisar que el test termine sin fallos ni omisiones.
- La limpieza elimina únicamente registros de los dos identificadores aleatorios generados por la prueba; no realiza `dropDatabase`.
- No alcanza los endpoints HTTP, el JWT real ni el entorno de producción. Esas pruebas siguen pendientes antes del despliegue.

## Compensaciones inmutables — protección de despliegue

La ruta autenticada `POST /v81/transacciones/:id/compensaciones` queda **desactivada por defecto**.
En ausencia de `GRUK_FP_COMPENSACIONES_HTTP_ENABLED=true` (valor literal y sensible a mayúsculas), devuelve HTTP 503 con
`FP_COMPENSACIONES_NO_HABILITADAS`, sin ejecutar el registrador ni ajustar ninguna cuenta.
El `GET /v81/transacciones/:id/estado-compensado` es de solo lectura y verifica el historial y la titularidad.

**No activar el POST en Render** hasta cerrar [issue #407](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407):
sustituir las mutaciones legadas PATCH/DELETE por eventos compensatorios, integrar proyecciones verificadas
en todos los resúmenes, resolver obligaciones recurrentes y comprobar end-to-end autenticación,
autorización, idempotencia y conciliación con MongoDB real. Un CI aprobado en esta rama
**no equivale** a la autorización de exposición pública de la ruta.

## Diagnóstico de reconciliación entre lecturas

`GET /v81/diagnostico-proyecciones?desde=<ISO>&hasta=<ISO>` se encuentra tras el
JWT y entitlement personales. Lee movimientos, eventos y cursor desde **un mismo
snapshot MongoDB** y valida toda la cadena SHA-256 antes de comparar:
`legado` reproduce la **base histórica anterior al arreglo** del agregado (incluidos compromisos
con `impactoCaja:false`); el `flujoPeriodo` actual ya excluye expresamente esos compromisos. `verificado` aplica las compensaciones firmadas y
excluye obligaciones pendientes. `diferenciaVerificadoMenosLegado` es una resta
exacta sobre enteros. `obligacionesNoCajaIncluidasPorLegado` cuenta asientos
sin impacto real de caja incluidos en la lectura legada, e
`importeObligacionesNoCajaMinor` cuantifica exactamente su importe en COP.
El comparador también exige que el flujo verificado cuadre con ingresos menos gastos
menos pagos de deuda antes de emitir el diagnóstico.
`diferenciaExplicadaPorNoCajaMinor` resta del legado el efecto firmado de
movimientos que no cambiaron la caja; `diferenciaResidualMinor` muestra la
parte restante atribuible a otras discrepancias, incluidas compensaciones.
Estos dos componentes suman exactamente `diferenciaVerificadoMenosLegado.flujoNetoMinor`.
`totalesCoinciden:true` solo indica que las columnas agregadas son iguales.\n`coincide:true` requiere además que las divergencias por operaciones sin caja y\nel residual sean ambos cero. Si los errores opuestos se cancelan, devuelve\n`totalesCoinciden:true` pero **`coincide:false`**; ninguna vista debe\nmostrar esos datos como plenamente conciliados.

La respuesta es **diagnóstica** (marca `DIAGNOSTICO_NO_APTO_COMO_SALDO_BANCARIO`),
NO sustituye el saldo de una cuenta ni modifica dinero. Si hay adulteración,
historial incompleto o desbordamiento, la consulta falla cerrada. El comparador
NO reconcilia reservas recurrentes ni justifica habilitar el POST compensatorio
hasta cerrar #407.

## Operaciones heredadas sobre compromisos sin pago

Mientras siga abierto #407, los métodos heredados de corrección y anulación
rechazan con HTTP 409 los movimientos `impactoCaja:false`. Un compromiso
pendiente no produjo débito y no debe generar un reverso ficticio en la cuenta.
La verificación se realiza dentro de la transacción y **antes de modificar
movimiento, saldo o outbox**. Es una restricción temporal de seguridad: la
edición y cancelación de obligaciones planificadas necesitará un flujo propio
que conserve historial y reservas de cuotas. No cambiar manualmente
`impactoCaja` para eludir el bloqueo.

## Vinculación inalterable de la cuenta de origen en operaciones heredadas

Mientras se completa la migración de #407, las correcciones y anulaciones
heredadas que impactan caja deben identificar la cuenta por `cuentaId` del
asiento original **y** confirmar titular, nombre, estado activo y moneda COP.
No basta con buscar por etiqueta: dos cuentas desincronizadas podrían provocar
una devolución o descuento a una cuenta diferente. Los asientos antiguos sin
`cuentaId` verificable se bloquean con HTTP 409 y requieren conciliación;
no debe reconstruirse ni adivinarse automáticamente la cuenta de origen.
La transacción revierte todos sus cambios si la validación no se satisface.

## Precisión de correcciones heredadas

Los deltas de `corregirTransaccion` y los reversos de `anularTransaccion`
se calculan con `BigInt` antes de actualizar la cuenta. Aunque los importes
original y corregido sean enteros seguros por separado, cambiar de `GASTO`
a `INGRESO` puede exceder `Number.MAX_SAFE_INTEGER` en la diferencia;
eso produce conflicto HTTP 409 y aborta la operación completa sin cambiar
saldo, documento u outbox. Esta protección no reemplaza la migración a
asientos inmutables pendiente en #407.

## Flujo realizado corregido

El agregado heredado `flujoPeriodo` **ya excluye** movimientos con
`impactoCaja:false`, de modo que registrar una cuota de arriendo prevista no
altera los ingresos, gastos o flujo neto realizados. Los pagos vinculados que
sí impactan caja siguen contándose una vez. La respuesta de
`/v81/diagnostico-proyecciones` mantiene intencionalmente la **base histórica
previa al filtro**, identificada como `BASE_HISTORICA_PRE_FILTRO_IMPACTO_CAJA`,
para medir el error que existía y los efectos de compensaciones; el campo
`legado` del diagnóstico **no debe presentarse como una lectura en vivo**.

## Alta de obligaciones previstas: protección contra cobro ficticio

`registrarTransaccion` rechaza con HTTP 422 una solicitud explícita con
`impactoCaja:false`. El alta vigente crea un movimiento con impacto en
cuenta y no dispone todavía de un procedimiento transaccional separado
para obligaciones planificadas. **Nunca** debe convertir silenciosamente
`impactoCaja:false` en un gasto pagado o ingreso recibido. La restricción
ocurre antes de iniciar MongoDB y aplica incluso a llamadas internas.
Registrar obligaciones sin pago requiere un servicio propio que conserve
vencimientos y cuotas sin alterar la caja, pendiente de #407.

## Alta de obligaciones previstas (V81, rama de desarrollo)

`POST /v81/obligaciones-previstas` acepta exclusivamente
`montoMinor` entero positivo COP, `concepto`, `categoria`,
`fecha` de vencimiento, `recurrente`, `frecuencia` coherente
y `externalId` estable. La identidad proviene del JWT personal.

Inserta el compromiso en `fin_transacciones_personales` con
`impactoCaja:false`, `cuentaId:null` y `cuenta:"SIN_CAJA"`.
NO modifica el saldo de ninguna cuenta, NO ejecuta un evento de
`GASTO_REGISTRADO` ni lo incluye en el flujo realizado.
Requiere `PERSONAL_IDEMPOTENCY_SECRET`, índice único real
`{usuarioId,externalIdHash}` y transacción MongoDB snapshot/majority;
el reintento con la misma clave devuelve 409 sin segunda inserción.
La fecha futura es válida porque representa vencimiento, no gasto ejecutado.

**Pendiente antes de producción:** definir cómo listar y cancelar
compromisos futuros sin mutar asientos originales, consolidar
proyecciones recurrentes y controles de autorización end-to-end.
El registrador antiguo `POST /transacciones` continúa rechazando
`impactoCaja:false`: usar solo la ruta específica para compromisos.
La nueva ruta vive únicamente en el PR hasta revisión y despliegue autorizado.

## Integridad del vencimiento de obligaciones

El servicio de obligaciones verifica que la fecha sea un instante ISO-8601
con zona explícita, o un objeto `Date` ya validado por Joi. Además valida
los componentes del calendario local antes de aceptar el vencimiento:
no normaliza silenciosamente fechas imposibles (por ejemplo, 30 de febrero)
ni offsets inválidos. La zona `-05:00` permite representar vencimientos
colombianos sin desplazar el día del compromiso. No altera caja ni constituye
un pago realizado.

**Bloqueos de entrega:** #453 (dependencias HTTP compartidas vulnerables)
y #407 (cancelaciones/proyecciones inmutables). No fusionar ni desplegar
hasta que auditoría de producción y pruebas integrales estén verdes.

## Parche de dependencias compartidas — octubre de 2026

En el PR #381, GitHub Actions generó con `npm install --package-lock-only`
la actualización reproducible del manifiesto y `package-lock.json`:
`multer@2.5.0` y `body-parser@2.4.0` (override transitorio por ser
dependencia transitiva de Express). Se verificaron `npm ci`,
`npm audit --omit=dev --audit-level=low`, pruebas unitarias sin base
externa y sintaxis. Los jobs dedicados V81 y Seguridad también aprobaron
tras aplicar los archivos. La remediación no equivale a desplegar
ni a cerrar el pendiente de migración contable #407.
Véase el issue de seguimiento #453.

## Cancelación append-only de obligaciones previstas (servicio interno)

`crearCanceladorObligacion` crea un documento en
`fin_cancelaciones_obligaciones_previstas_v1` dentro de MongoDB ACID,
con `usuarioId`, `obligacionId`, hash HMAC de clave idempotente, motivo,
fecha y snapshot del compromiso original. Exige índices únicos
`(usuarioId,obligacionId)` y `(usuarioId,idempotencyHash)`; la
repetición o cancelación concurrente devuelve conflicto. No realiza
`UPDATE`/`DELETE` del asiento original ni altera cuentas.

**Fail-closed:** si el compromiso tiene abonos o reservas históricas,
rechaza la cancelación; su anulación exige un procedimiento de
conciliación especializado. La protección de solo inserción necesita
además privilegios MongoDB restrictivos: middleware Mongoose por sí solo
no impide modificaciones directas por administradores de la base.

**NO habilitado en HTTP ni producción:** la cancelación aún no se
proyecta en los vencimientos, y el historial carece de un anclaje
criptográfico externo específico. No conectar esta operación al
frontend ni declarar el ledger íntegramente inmutable hasta
integrar proyección, auditoría y pruebas Mongo reales (#407).

## Proyección aislada de obligaciones previstas y canceladas (V81)

`proyeccionObligacionesPrevistasPersonal.service.js` consulta los asientos
originales `SIN_CAJA` y los eventos de cancelación en **el mismo snapshot
MongoDB**. Verifica identidad de usuario, unicidad por obligación, ausencia
de eventos huérfanos y coincidencia exacta de sus snapshots; ante cualquier
inconsistencia **no entrega un saldo parcial**. Los totales se agregan
con `BigInt` y se entregan como cadenas decimales
(`pendienteMinor` y `canceladoMinor`), no como flotantes.

Alcance restringido: suma **solo obligaciones originalmente registradas
con fecha dentro del período solicitado**. No expande todavía cuotas
mensuales futuras ni compensa cuotas efectivamente pagadas. No reemplaza
el cálculo de `Disponible Hoy`, `homePersonal` ni el calendario existente.
Esta consulta permanece interna hasta integrarse con conciliación recurrente
y controles de autorización HTTP (#407). No presentar los totales como
deuda completa ni modificar caja con sus resultados.

## Recurrencias previstas — calendario bruto, no saldo

`programarVencimientosBrutosPersonal.service.js` genera vencimientos
teóricos para frecuencias diaria, semanal, quincenal, mensual y anual,
anclados a la fecha civil y hora de Colombia (UTC-05). Las cuotas
mensuales del día 31 se ajustan al último día de febrero y recuperan
el día 31 en marzo; los años bisiestos se calculan desde la fecha base,
sin deriva por repetir sumas sobre la fecha anterior.

`proyectarCalendarioBruto` exige verificar originales y eventos de
cancelación mediante `proyectarObligaciones` antes de generar. Las
cancelaciones ya registradas excluyen los vencimientos teóricos de
la vista. La ventana máxima es 366 días y cada origen tiene límite
de 1000 ocurrencias; se rechaza la solicitud fuera del rango.

**No representa dinero realmente pendiente:** el calendario aún NO
descuenta abonos parciales, cuotas pagadas ni deudas formalizadas
por otra vía. Responde `aptoParaDisponibleHoy:false` y
`pagosParcialesConciliados:false`. Es un cálculo interno, no conectado
a `homePersonal`, al frontend ni a la API pública de cancelación.
Falta conciliación recurrente antes de usarlo en una decisión de gasto (#407).

## Conciliación pura de abonos explícitos (V81)

`conciliarCuotasPrevistasPersonal.service.js` parte de una obligación
`SIN_CAJA` y de una lista explícita de pagos vinculados a su mismo
`recurrenteOrigenId`. Para cada período civil colombiano genera el
importe teórico, suma abonos reales de ese ciclo con `BigInt` y
calcula `pendiente = max(cuota - abonos, 0)`. Rechaza IDs repetidos,
pagos ajenos, anulados, sin caja, importes inválidos y sobrepagos.
Los resultados se devuelven como cadenas decimales exactas.

**Límite de seguridad:** es un conciliador interno puro, aún no lee
automáticamente ni verifica una cadena compensatoria completa ni reservas
históricas. Tampoco asigna pagos anticipados a ciclos futuros. Su salida
indica `aptoParaDisponibleHoy:false` y NO alimenta `homePersonal`,
ni autoriza editar saldos; antes de producción debe leerse toda la
historia relevante en un snapshot MongoDB y resolver pagos compensados
y compromisos cancelados (#407).

## Barrera de pagos compensados antes de conciliar cuotas

`guardiaCuotasCompensadasPersonal.service.js` verifica la cadena
SHA256 de eventos compensatorios desde génesis y la correspondencia
exacta del cursor antes de revisar abonos asociados con una obligación
recurrente. Cualquier corrección o anulación de un abono vinculado
bloquea por error `409 CUOTA_COMPENSADA_NO_CONCILIADA`: la reserva
de cuota todavía puede conservar el importe anterior y no es seguro
presentar un saldo pendiente. No se extrapola una corrección como
nuevo abono hasta verificar la reserva y su aplicación ACID.

`conciliarCuotasConCadenaPersonal.service.js` permite combinar esta
barrera con el conciliador puro. **Precondición obligatoria:** quien
lo invoque debe obtener la totalidad de los pagos vinculados,
historial completo de compensaciones y cursor dentro del mismo
snapshot MongoDB. Esta funcionalidad es exclusivamente interna;
no hay ruta HTTP de consulta, y responde
`aptoParaDisponibleHoy:false`. El verificador de hash no sustituye
la reconciliación de reservas ni impide adulteración por quienes
controlan la base de datos sin anclaje independiente (#407).

## Consulta íntegra de cuotas recurrentes — snapshot MongoDB

`consultaCuotasConciliadasPersonal.service.js` es una consulta interna
de **solo lectura** que obtiene secuencialmente, dentro de la misma
transacción MongoDB con `readConcern:snapshot`, el origen previsto,
todos sus pagos vinculados, la cadena compensatoria completa del usuario,
el cursor, las reservas recurrentes y cualquier cancelación del origen.
Rechaza lecturas truncadas, cancelaciones, importes o rangos de reservas
discordantes, abonos sin reserva, hash/cursor contradictorios y eventos
compensatorios asociados con pagos no reconciliados. El período de cada
reserva debe coincidir con el período civil de Bogotá.

Nunca actualiza `Cuenta`, `Transaccion`, `ReservaCuota` ni otros
saldos. Excluye de forma preventiva obligaciones canceladas y retorna
`aptoParaDisponibleHoy:false`; no es una ruta HTTP, ni cálculo de deuda
completa, ni sustituye los controles del ledger de producción. La
conciliación de compensaciones con reservas y el control de privilegios
de base de datos siguen pendientes en #407.

## Auditoría forense de reservas históricas (servicio interno)

`auditarReservasRecurrenciaPersonal.service.js` analiza asientos de pagos
vinculados, incluidos aquellos que la ruta legada marcó `ANULADA`,
y compara la suma exacta de pagos vigentes por período civil Bogotá
contra `reservadoMinor`. Reporta los códigos
`RESERVA_DESCUADRADA`, `FALTA_RESERVA`,
`RESERVA_SIN_ABONOS` o `PERIODO_INCORRECTO`
sin hacer `UPDATE` ni inventar movimientos compensatorios. Si detecta
compensaciones sobre esos pagos, cadena/cursor inconsistente,
un pago ajeno, duplicado o malformado, se bloquea con 409.

Las anomalías contienen importes como cadenas decimales exactas;
su diagnóstico no autoriza modificar ni liberar compromisos.
**Precondición:** todas las listas deben proceder de un único snapshot
transaccional completo del usuario, sin recortes por fecha; el test
MongoDB aislado demuestra detección sobre registros reales, pero el
servicio puro no realiza por sí mismo la lectura transaccional.
No se conecta a `Disponible Hoy` ni a ninguna API pública y devuelve
`aptoParaDisponibleHoy:false`; la remediación de reservas con
historial append-only sigue pendiente (#407).

## Fence de escritura para compensaciones de cuotas recurrentes

`registradorCompensacionPersonal.service.js` bloquea ANTES de
actualizar el cursor, insertar eventos o aplicar deltas de caja cualquier
compensación genérica cuyo asiento tenga `recurrenteOrigenId` o
`recurrente:true`. Estos movimientos requieren un aplicador propio
que sincronice **evento, saldo y reserva recurrente** en una sola
transacción ACID. Hasta que exista, ni el registrador de bajo nivel
ni la fábrica financiera deben producir compensaciones sobre ellos.
La prueba MongoDB real verifica rechazo 409, saldo y eventos intactos.
La ruta legada de anulación de abonos continúa siendo otra deuda técnica
de inmutabilidad (#407), no se ha migrado automáticamente.

## Auditoría forense con lector transaccional propio

`consultaAuditoriaReservasPersonal.service.js` obtiene origen SIN_CAJA,
histórico completo de sus abonos (incluidas anulaciones legadas),
reservas, cadena compensatoria del usuario, cursor y cancelación en un
**único snapshot MongoDB**, con lecturas secuenciales y límite de 10.000.
No acepta listas suministradas por frontend, ni expone un endpoint.
Si existe una cancelación, un cursor corrupto o un histórico truncado,
rechaza el dictamen. Permite identificar una diferencia de un peso en
`reservadoMinor` sin tocar caja, ledger ni reservas.

La auditoría continúa como servicio interno de solo lectura:
`aptoParaDisponibleHoy:false`. Detectar una discrepancia no equivale
a autorizar su reparación; el procedimiento de reverso financiero
append-only y conciliación de saldos permanece bloqueado por #407.

## Previsualización forense de reparación (sin escrituras)

`planReparacionReservasPersonal.service.js` convierte el dictamen de
auditoría verificado en propuestas de solo lectura: para una
`RESERVA_DESCUADRADA` determina `deltaMinor=esperado-observado`
utilizando `BigInt`; para `FALTA_RESERVA` propone crear una reserva
**solo tras verificación**. Para `PERIODO_INCORRECTO` y
`RESERVA_SIN_ABONOS` exige revisión manual. Rechaza anomalías
contradictorias, importes no enteros y períodos duplicados; retorna
`huellaDiagnostico` SHA-256 para identificar el plan, no para
autorizar operaciones. `consultaAuditoriaReservasPersonal.service.js`
adjunta este plan a su resultado dentro del **mismo snapshot**.

La salida establece `autorizaEscritura:false`,
`requiereReauditoriaAtomica:true` y `aptoParaDisponibleHoy:false`.
No se ha construido ni habilitado ningún endpoint ni ejecutor de
reparaciones. El futuro ejecutor deberá autorizar la operación, volver
a validar bajo bloqueo transaccional y dejar un evento inmutable con
su correspondiente reserva actualizada de forma atómica (#407).

## Verificador de vigencia de planes (interno y sin escrituras)

`verificarVigenciaPlanReservasPersonal.service.js` recalcula la huella
SHA-256 del diagnóstico actual y la compara en tiempo constante con la
huella anterior. La consulta `consultaAuditoriaReservasPersonal`
puede recibir la opción `huellaEsperada` y realiza esa comparación
**dentro del snapshot MongoDB** donde obtuvo pagos, reservas, cursor,
eventos y cancelaciones. Si cambia siquiera un peso, si el problema
desapareció, la huella está malformada o requiere revisión manual,
responde con error en vez de declarar vigente una propuesta antigua.

**No autoriza escrituras:** la huella SHA-256 no autentica al usuario,
no reemplaza un bloqueo CAS ni una firma; no puede impedir que los datos
cambien DESPUÉS de la comprobación. Un eventual ejecutor tendrá que
reanudar toda la verificación y asegurar atomicidad con un documento de
control de concurrencia, permisos, evento append-only e idempotencia.
La salida confirma explícitamente `autorizaEscritura:false` y
`aptoParaDisponibleHoy:false` (#407).

## Control de concurrencia previo: huella del estado completo

`huellaEstadoReservasPersonal.service.js` construye una huella SHA-256
determinística de la obligación, TODOS los abonos vinculados (activos y
anulados), reservas por período y cursor de la cadena compensatoria,
ordenando registros antes del hash y validando identidades y duplicados.
`consultaAuditoriaReservasPersonal.service.js` devuelve
`huellaEstado` y permite compararla mediante
`huellaEstadoEsperada` dentro del mismo snapshot MongoDB. La
comparación detecta cambios que dejarían invariable el delta del
diagnóstico anterior, como sustituir un pago por dos abonos de igual suma.

**NO es todavía un bloqueo CAS:** un SHA-256 del estado no autentica
ni garantiza inmutabilidad externa; tampoco impide una escritura
concurrente posterior al snapshot. Este token no habilita endpoint,
`Disponible Hoy` ni reparación alguna. Toda ejecución futura debe
volver a validar con bloqueo transaccional, índices únicos y un
evento de reparación append-only (#407).

## Preparación de CAS de reservas (sin escrituras)

`condicionCasReservaPersonal.service.js` construye un filtro
compare-and-swap (CAS) que obliga a coincidir exactamente con
`_id`, `usuarioId`, `origenId`, `periodoInicio`,
`periodoFin`, `importeCuotaMinor` y `reservadoMinor`
anterior. Rechaza importes no enteros, períodos inválidos, reservas
ajenas y propuestas superiores a la cuota. Devuelve un delta BigInt
decimal, **sin ejecutar UPDATE** ni permitir una reparación todavía.

La integración MongoDB real comprueba que un filtro preparado contra
una reserva de $200.000 no encuentra el mismo documento cuando ha
cambiado a $199.999. Esto demuestra la semántica del filtro, NO la
seguridad de un ejecutor concurrente. Antes de activar reparaciones
faltan: transacción ACID con fence compartido frente a escrituras
legadas, reauditoría dentro de esa transacción, índice de idempotencia,
evento append-only, rollback, prueba de carreras y permisos. #407.

## Evento de reconciliación de reserva (evidencia, aún sin ejecución)

`models/EventoReconciliacionReservaPersonal.js` define un
documento append-only con índice único de
`(usuarioId, idempotencyHash)`, identidad de obligación/reserva,
período, huellas previas y de diagnóstico, importes antes/después,
delta y hash SHA-256. `eventoReconciliacionReservaPersonal.service.js`
construye y comprueba el payload canónico de forma determinística,
con acumulados BigInt y límites monetarios seguros.

Se prueban las restricciones del modelo en MongoDB real aislado:
una segunda inserción con la misma idempotencia falla, y Mongoose
rechaza UPDATE y DELETE. Estas defensas de aplicación NO bastan
contra privilegios directos en MongoDB. La huella del evento NO forma
una cadena global ni está anclada fuera de la base.

**Importante:** hoy no existe ejecutor que escriba estos eventos
junto con una actualización de reserva. Los tests insertan evidencia
ficticia en una base de pruebas efímera, sin tocar ningún saldo.
Antes de habilitar reparaciones se requieren autorización,
transacción ACID, reauditoría en el mismo snapshot, fence de
concurrencia, verificación del índice y permisos insert-only (#407).

## Ejecutor ACID restringido de reserva — interno, sin API pública

`ejecutarReparacionReservaPersonal.service.js` implementa un caso
limitado de reparación: **una sola reserva existente con un único
RESERVA_DESCUADRADA**. Verifica el índice único de idempotencia ya
instalado, abre transacción MongoDB `snapshot` + `majority`,
consulta de manera secuencial obligación, todos sus pagos, reservas,
cadena, cursor y cancelación; contrasta la huella completa y el
diagnóstico esperado, y reaudita con el motor forense dentro de la
misma sesión. Exige importe entero, CAS de reserva con identidad y
período completos y toma un fence sobre el cursor del usuario.
Confirma la reserva y la evidencia append-only en esa transacción;
si una falla, se revierte todo. Nunca cambia `Cuenta.saldoMinor`
ni escribe en `TransaccionPersonal`.

**No implementar un endpoint sin revisión adicional:** el ejecutor
verifica un proveedor de autorización inyectado, pero todavía NO tiene
un proveedor de identidad y permisos de producción ni un flujo de
aprobación administrativa de reparaciones. Mantenerlo inaccesible desde HTTP.
No atiende reservas faltantes, dos o más anomalías, períodos corruptos
ni abonos con compensaciones no conciliadas. Una reparación de una
reserva no autoriza `Disponible Hoy`; aún falta revisar privilegios
Mongo insert-only, límites de escalamiento, trazabilidad de actor y
controles de acceso, y rutas heredadas que mutan el ledger (#407).

## Autorización del actor para la reparación ACID interna

El ejecutor `crearEjecutorReparacionReserva` ahora **deniega por
defecto** su construcción sin un proveedor de autorización confiable
`autorizarActor`. El proveedor debe consultar identidad y permisos
reales desde el servidor, no aceptar una afirmación del cliente.
Se comprueba permiso `RECONCILIAR_RESERVA_PERSONAL` tanto antes de
consultar índices como **nuevamente dentro de la transacción MongoDB**.
En caso de denegación o revocación, aborta sin afectar reservas,
cuentas ni eventos. Los eventos nuevos exigen `actorId` y lo incluyen
en su huella SHA-256; su adulteración invalida la verificación.

**Pendiente para uso real:** aún NO hay un proveedor de autorización
de producción conectado ni un origen de identidad autenticada que
impida suplantar el campo `actorId` suministrado al servicio.
La prueba usa un proveedor aislado inyectado. La autorización
externa tampoco sustituye permisos insert-only de MongoDB, control
de aprobaciones de operaciones sensibles, ni bloqueo de rutas heredadas
(#407). No exponer este ejecutor por HTTP ni desplegarlo.

## Regresión de permisos y atribución del evento

`test/gruk/ejecutor-reparacion-autorizacion-personal.test.js`
comprueba denegación por defecto, exigencia de `true` estricto,
validación de `actorId` y revocación antes de cualquier lectura
financiera. El test de MongoDB real también lee el evento creado,
comprueba el campo `actorId` persistido y verifica que alterarlo
invalida la evidencia SHA-256. Esto confirma atribución técnica,
**no** identidad autenticada ni aprobación para producción (#407).
