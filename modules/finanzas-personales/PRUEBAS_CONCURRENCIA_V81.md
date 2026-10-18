# GRUK Finanzas Personales V81 — concurrencia e idempotencia

## Objetivo
La confirmación de una cuenta para un asiento histórico escribe evidencia en
`fin_vinculos_historicos_v81`. No debe actualizar la transacción original ni
`saldoMinor` de la cuenta. Dos solicitudes concurrentes idénticas deben
guardar un solo vínculo. Cambiar la clave o la evidencia debe resultar en
conflicto, no en un segundo movimiento.

## Ejecución aislada
El workflow `.github/workflows/finanzas-personales-ci.yml` crea una instancia
temporal **MongoDB 7** en el runner de GitHub y la configura como réplica de
un nodo para soportar transacciones. No se conecta a MongoDB productivo.

La prueba `test/gruk/confirmacion-vinculo-mongo-concurrencia.test.js` solo
accede a `mongodb://127.0.0.1:<puerto>` o IPv6 loopback, requiere
`directConnection=true` y la confirmación literal
`GRUK_TEST_DB_CONFIRM=SOLO_PRUEBAS_LOCALES`. Usa exclusivamente la base
`gruk_v81_vinculos_concurrencia` y nuevos identificadores de usuario.

La ejecución local, con MongoDB replica set ya levantado, es:

```bash
GRUK_TEST_DB_CONFIRM=SOLO_PRUEBAS_LOCALES \
TEST_MONGO_URI='mongodb://127.0.0.1:27017/?directConnection=true' \
node --test test/gruk/confirmacion-vinculo-mongo-concurrencia.test.js
```

Sin `TEST_MONGO_URI`, el test de integración se omite, mientras la validación
de direcciones locales sigue ejecutándose. **Un resultado verde de la suite
ordinaria no prueba concurrencia con MongoDB** si este test figura como omitido.

## Criterios de aprobación
- Solo un documento vinculado por `{usuarioId,movimientoId}`.
- Idempotencia contra la clave única `{usuarioId,idempotencyKeyHash}`.
- Reintento idéntico: `yaExistia:true`, sin escritura nueva.
- Evidencia o clave contradictoria: HTTP 409 a nivel del servicio.
- Saldo de cuenta sin cambios.
- Monto y `cuentaId` del movimiento histórico sin cambios.

El test no mide la seguridad integral de MongoDB, la resiliencia entre regiones
ni la capacidad para un millón de usuarios. La promoción a producción debe
verificar además GitHub Actions, índices de MongoDB y logs del servicio.
