# GRUK Empresarial — Política de activación del outbox de ventas

## Estado

**NO ACTIVAR el despachador periódico en producción todavía.** Este documento describe condiciones de aceptación; no certifica que estén satisfechas.

## Hallazgos verificados en la rama

- `services/ventas.service.js` registra `VENTA_COMPLETADA` en outbox si recibe una sesión MongoDB.
- La misma función conserva una ruta `!session` que emite directamente al `eventBus`, sin comprobante persistente ni recuperación automática.
- `emitirVentaCompletada(venta)` también emite directamente al bus.
- `core/eventos/ventaOutbox.dispatcher.js` ofrece entrega **at-least-once**, lease de 60 segundos y confirmación condicionada por `leaseToken`.
- El dispatcher espera listeners asíncronos y rechaza listeners `once()`, pero no controla su duración máxima ni renueva leases.
- `core/eventos/consumidorIdempotente.service.js` vincula efectos MongoDB y recibo idempotente en una transacción. Su callback `aplicar` debe utilizar la sesión proporcionada en **todas** las escrituras.

## Bloqueos para producción

1. Inventariar todas las llamadas a `registrarVentaDesdePedido` y `emitirVentaCompletada`. Migrar las rutas que producen efectos críticos a una transacción que persista venta y outbox de forma atómica. No eliminar las rutas heredadas sin confirmar su compatibilidad.
2. Registrar explícitamente los consumidores durables; cada consumidor debe usar un identificador estable y `consumirEventoUnaVez`. Prohibir efectos externos no idempotentes dentro de `aplicar`.
3. Definir y probar renovación de lease o un límite de ejecución menor al lease; un consumidor lento puede ejecutarse simultáneamente en dos workers después de 60 segundos.
4. Instrumentar métricas: eventos pendientes, eventos procesando con lease vencido, intentos, edad del evento más antiguo y fallos por consumidor.
5. Establecer política de reintentos, backoff, alertas y cuarentena de eventos persistentemente fallidos; evitar bucles calientes.
6. Probar pérdida de conexión MongoDB, reinicio entre commit y ACK, caída durante procesamiento, concurrencia multi-worker y despliegue gradual con rollback.
7. Ejecutar el gate CI y pruebas de integración contra MongoDB replica set; revisar índices e impacto en datos existentes antes de migraciones.

## Invariantes de aceptación

- Ninguna venta monetaria confirmada se pierde por un fallo del proceso entre el commit y la notificación.
- Un reintento de un mismo evento no duplica un asiento contable ni un cobro.
- Los consumidores no mezclan datos entre empresas.
- Un worker cuyo lease venció no puede confirmar el evento de otro worker.
- El estado `ENTREGADO` solo se alcanza tras completar las confirmaciones durables exigidas.

## Limitación explícita

Un `EventEmitter` en memoria no proporciona una cola distribuida ni ACK durable por consumidor. El ACK global actual no sustituye los recibos individuales ni la reconciliación de efectos externos. No se garantiza exactamente una ejecución; la meta verificable es **efecto idempotente con entrega al menos una vez**.
