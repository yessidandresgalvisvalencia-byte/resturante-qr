# Inventario verificado de publicación de ventas (rama de trabajo)

Fecha de revisión: 2026-10-15. Alcance: archivos inspeccionados en `feat/gruk-enterprise-tenant-idempotency-audit`. **No constituye un inventario exhaustivo del repositorio**.

## Llamadas verificadas

| Archivo | Punto | Sesión | Publicación | Observación |
| --- | --- | --- | --- | --- |
| `routes/API.js` | Confirmación manual de pago | `session` en `withTransaction` | `registrarVentaDesdePedido({ ..., session, emitirEvento: false })` | Venta y outbox se escriben en la transacción; `pedido.save({ session })` también participa. |
| `services/pagosPedidos.service.js` | Aprobación Wompi | `session` en `withTransaction` | `registrarVentaDesdePedido({ ..., session, emitirEvento: false })` | Venta y outbox se escriben en la transacción; pedido e intento de pago se guardan con sesión. |
| `services/ventas.service.js` | Servicio de ventas | Opcional | Con sesión: outbox; sin sesión: EventBus directo si `emitirEvento` | Es una bifurcación de garantías. |
| `services/ventas.service.js` | `emitirVentaCompletada(venta)` | Ninguna | EventBus directo | Función heredada exportada; consumidores/llamadores no inventariados. |

## Control ya incorporado

`registrarVentaDesdePedido` rechaza `emitirEvento: false` sin `session` con `GRUK_VENTA_SIN_SESION_TRANSACCIONAL`. **Una sesión presente no demuestra por sí sola que exista una transacción activa**. La seguridad de las rutas verificadas depende de su `withTransaction` y de que todos los efectos MongoDB usen la misma sesión.

## Bloqueos antes de eliminar EventBus directo

1. Enumerar en la rama completa todas las referencias a `registrarVentaDesdePedido`, `emitirVentaCompletada` y `VENTA_COMPLETADA`, incluyendo importaciones indirectas y pruebas.
2. Para cada llamador sin transacción, migrar venta, pedido, pago y outbox a una única transacción o definir explícitamente su compatibilidad.
3. Auditar consumidores EventBus: cualquier efecto financiero debe ser idempotente y transaccional; los efectos externos requieren un mecanismo propio de entrega idempotente.
4. Confirmar índices únicos multi-tenant y migración segura en producción.
5. Ejecutar CI, pruebas de fallos y rollback antes de habilitar workers del outbox.

**No habilitar el despachador en producción ni afirmar entrega exactamente una vez.** El modelo actual es entrega al menos una vez.
