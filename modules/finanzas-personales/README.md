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
- Nunca ejecutarla con `NODE_ENV=production`. No admite conexión sin nombre de base de pruebas: en ese caso la prueba se marca como **omitida**, lo que NO constituye validación.
- Ejecutar `npm run test:personal:mongo-idempotencia` tras levantar el replica set local y configurar su URI. Para CI, usar un servicio MongoDB efímero dedicado.
- La limpieza elimina únicamente registros de los dos identificadores aleatorios generados por la prueba; no realiza `dropDatabase`.
- No alcanza los endpoints HTTP, el JWT real ni el entorno de producción. Esas pruebas siguen pendientes antes del despliegue.
