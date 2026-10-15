# Bloqueo de activación: doble representación de ingresos

Fecha: 2026-10-15. Rama: `feat/gruk-enterprise-tenant-idempotency-audit`.

## Evidencia verificada

1. `core/eventos/ventaOutbox.service.js` registra un evento durable `VENTA_COMPLETADA` y una entrega `CAJA_VENTA_V1` en la transacción de la venta.
2. `core/eventos/cajaVenta.consumer.js` consume esa entrega mediante `consumirEventoUnaVez` y llama a `registrarMovimientoDesdeEvento`.
3. `core/finanzas/caja.service.js` convierte `VENTA_COMPLETADA` en un movimiento de `MovimientoCaja` con `direccion: ENTRADA` y `tipoAsiento: CONFIRMACION`.
4. `core/finanzas/services/ventaConLedger.service.js` añade un `ABONO` a `GrukLedgerV1` y crea la venta con su outbox en la misma transacción.
5. Los dos registros usan modelos y claves de idempotencia diferentes. No hay en el servicio nuevo una relación explícita entre el asiento `GrukLedgerV1` y el movimiento `MovimientoCaja`.

## Riesgo y decisión

**NO ACTIVAR** `registrarVentaConLedger` en el flujo de producción hasta elegir una fuente de verdad para saldos y definir cómo conciliar ambos registros sin sumarlos dos veces.

La existencia de dos registros no prueba que el saldo esté duplicado hoy; el riesgo surge al agregarlos sin una regla de exclusión o proyección.

## Condiciones para retirar el bloqueo

- Elegir formalmente el libro de caja autoritativo y definir si el otro registro es una proyección, auxiliar o parte de una migración.
- Vincular por identidad estable `empresaId`, `sedeId`, `ventaId`, `eventId` y la clave de idempotencia, con conciliación verificable.
- Probar una venta, reintento, dos ventas concurrentes, reversión y fallo de entrega; exigir un solo efecto económico en reportes de caja.
- Mantener `CAJA_VENTA_V1` activo hasta demostrar un reemplazo compatible; no desactivar consumidores sin migración.
- Validar el cambio con un feature flag desactivado por defecto, pruebas de rollback y revisión de datos históricos.

## Estado

Bloqueo documental preventivo. No implica despliegue ni cambio en el procesamiento actual.
