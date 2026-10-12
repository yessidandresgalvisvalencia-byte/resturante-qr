# GRUK P0 — Wompi: puerta de activación controlada

## Estado
Rama experimental. **NO habilitado ni autorizado en producción.** El CI con MongoDB replica set es necesario, pero no suficiente para certificar pagos reales.

## Variables en staging exclusivamente
- `NODE_ENV=staging`
- `GRUK_P0_PEDIDOS_ENABLED=true`
- `GRUK_P0_PEDIDOS_RESTAURANTES=<identificador-de-restaurante-de-pruebas>`
- `GRUK_P0_WOMPI_RECONCILER_ENABLED=true` (solo después de validar el proveedor y la base de datos)
- `GRUK_P0_OUTBOX_WORKER_ENABLED=true` (requerido para procesar eventos financieros)
- `MONGO_URI`: clúster de pruebas con soporte de transacciones y replica set; nunca credenciales de producción.

El código bloquea explícitamente las funciones P0 cuando `NODE_ENV=production`. No cambiar este bloqueo para lanzar sin autorización y verificación independientes.

## Prerrequisitos obligatorios
1. Usar una empresa y un restaurante **de prueba** aislados, con productos y pedidos de prueba.
2. Confirmar conectividad e índices únicos para IntentoPagoPedido, Venta, GrukOutbox, GrukIngresoConfirmado y recibos idempotentes.
3. Validar la integridad del webhook firmado contra Wompi y la autenticación de consulta al proveedor.
4. Verificar que el checkout registre `transactionId` fiable antes de esperar reconciliación automática. Los intentos sin identificador permanecen fuera del conciliador.
5. Configurar alertas para errores recurrentes, reservas vencidas y acumulación de Outbox pendiente. Las métricas del lote no constituyen por sí solas un sistema de alertas.
6. Ejecutar el gate de CI y una prueba operativa manual con aprobación válida, rechazada, retrasada, entregas duplicadas, conflicto de reserva, respuesta económica inconsistente y caída simulada de MongoDB.
7. Reconciliar el estado del proveedor con la venta, el pedido, la proyección de ingreso y los eventos publicados.

## Criterios de aceptación antes de promocionar
- Una aprobación válida produce como máximo una venta y una proyección financiera por pedido.
- La operación ACID revierte ventas, pedido y eventos si no se puede confirmar íntegramente.
- Un intento no puede liquidarse con referencia, ID, importe o moneda contradictorios.
- Los consumidores de Outbox soportan reintentos y no duplican el ingreso confirmado.
- Ningún error de pasarela expone datos privados en los logs o diagnósticos.
- Las reservas expiradas se recuperan sin pérdida de propiedad silenciosa.
- Todos los flujos probados mantienen aislamiento por `empresaId` y restaurante.

## Plan de reversión
1. Desactivar `GRUK_P0_WOMPI_RECONCILER_ENABLED` y `GRUK_P0_OUTBOX_WORKER_ENABLED` en staging.
2. No borrar pedidos, intentos, ventas ni eventos Outbox; preservar trazabilidad.
3. Examinar pendientes por `transactionId`, comparar con la respuesta autorizada de Wompi y reconciliar manualmente cualquier anomalía.
4. Conservar capturas del CI y registros de auditoría; no promocionar a producción con anomalías abiertas.

## Límites actuales
- La consulta automática requiere un `transactionId` previamente persistido.
- El reconciliador se ha probado mediante respuestas de Wompi simuladas y MongoDB de integración; no equivale a certificación de transacciones reales ni revisión regulatoria.
- No se ha demostrado un despliegue ni un rollback operativo en Render/Atlas staging.
- Este documento es un runbook de staging y **no una autorización de despliegue**.
