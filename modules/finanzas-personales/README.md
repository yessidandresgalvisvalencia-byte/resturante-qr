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
`legado` reproduce la suma histórica usada por `flujoPeriodo` (incluidos compromisos
con `impactoCaja:false`); `verificado` aplica las compensaciones firmadas y
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
