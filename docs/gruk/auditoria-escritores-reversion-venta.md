# GRUK — Auditoría de escritores de reversión y bloqueo de órdenes

Estado: **BLOQUEANTE PARA PRODUCCIÓN**. Auditoría estática de la rama `feat/gruk-enterprise-tenant-idempotency-audit`, sin modificar rutas activas.

## Evidencia inspeccionada

- `core/finanzas/services/reclamarVentaConciliada.service.js`: exige transacción activa, concilia y ejecuta `findOneAndUpdate` condicional sobre `Venta.grukControlFinanciero.token`.
- `core/finanzas/services/conciliarVentaCajaLedger.service.js`: consulta reversiones de `MovimientoCaja` y valida que no existan, pero no bloquea a escritores de reversiones posteriores.
- `core/finanzas/caja.service.js`: `reversarMovimiento` localiza la confirmación activa y crea un asiento `REVERSION` mediante `crearIdempotente`; **no escribe en `Venta.grukControlFinanciero`**. En el constructor de eventos inspeccionado, la rama `REVERSAR` corresponde a cambios de pago de gastos y compras; no se identificó un evento de reversión de venta en ese constructor.
- `core/eventos/procesarEntregaCaja.service.js`: procesa entregas de caja mediante claim/ACK, no coordina reclamaciones financieras de `Venta`.

## Consecuencia

La prueba CI #1747 valida la competencia entre reclamaciones que actualizan la misma `Venta`. **No demuestra exclusión mutua entre una reclamación de venta y un escritor de reversión de Caja que solo inserte en otra colección.** Tampoco demuestra que todas las rutas posibles de anulación, devolución o corrección estén inventariadas.

## Condiciones obligatorias para desbloquear

1. Inventariar rutas HTTP, jobs, webhooks, scripts y consumidores que anulan ventas o insertan `MovimientoCaja.tipoAsiento=REVERSION` para `origenTipo=VENTA`.
2. Definir una única máquina de estados transaccional para venta: reclamable, reclamada, reversada, con reglas explícitas de transición y clave de operación.
3. Hacer que **cada** escritor de reversión de venta actualice condicionalmente el mismo documento `Venta` en la misma transacción que registra el asiento de reversión. El escritor que pierda el CAS debe abortar.
4. No utilizar el token de reclamación como autorización: exige actor, rol, alcance de tenant, motivo, monto exacto, idempotencia y auditoría durable.
5. Incorporar pruebas con dos sesiones que arranquen simultáneamente, una reclamando y otra revirtiendo la misma venta, en ambos órdenes de commit. Verificar que nunca coexistan dos resultados incompatibles.
6. Confirmar que `grukControlFinanciero` persiste según esquema Mongoose y que la transición es observable en auditoría; evitar depender de `strict:false` sin contrato de modelo explícito.
7. Mantener apagado el feature flag de ejecución financiera hasta que todos los escritores cumplan el protocolo y CI pase en réplica MongoDB.

## Decisión

**NO GO:** no conectar `reclamarVentaConciliada` al Cerebro, dashboard, aprobaciones ni rutas de cobro. La prueba de reclamaciones concurrentes es necesaria, pero insuficiente para autorizar dinero real.
