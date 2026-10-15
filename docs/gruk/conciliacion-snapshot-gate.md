# GRUK — Gate de consistencia temporal de conciliación

Estado: **BLOQUEANTE PARA PRODUCCIÓN**. Este documento no autoriza activar el conciliador.

## Riesgo observado

`conciliarVentaCajaLedger` realiza lecturas independientes de Venta, MovimientoCaja, GrukLedgerV1 y reversiones. Sin una vista consistente, una reversión concurrente puede confirmarse entre las consultas y el resultado `CONCILIADA` puede quedar obsoleto antes de devolverse. La rama contiene ahora una prueba de reversión concurrente con dos sesiones y lecturas snapshot; su aprobación en CI no sustituye la validación de autorización transaccional.

## Requisitos de activación

1. Ejecutar todas las lecturas de una conciliación en la misma sesión MongoDB y transacción de solo lectura con `readConcern: { level: "snapshot" }`; definir explícitamente el comportamiento ante `TransientTransactionError` y errores de snapshot.
2. Mantener filtros obligatorios por `empresaId`, `sedeId` y `ventaId`, incluidos movimientos de reversión.
3. No afirmar que el resultado es el estado más reciente después de la transacción: indicar instante o versión de corte. Para aprobar una decisión operativa, volver a verificar dentro de la transacción que materializa la decisión, con control de concurrencia.
4. Incorporar pruebas de integración con dos sesiones concurrentes: reversión antes del snapshot, durante la lectura y después del snapshot. El resultado debe ser consistente con el punto de corte y jamás autorizar efectos financieros con una lectura antigua.
5. No sumar Caja y Ledger como si fueran ingresos independientes. El ledger propuesto es una representación contable adicional; Caja sigue siendo la fuente operativa durante la migración.
6. Verificar que la cuenta de ledger coincide con el medio de pago y que el estado de venta es `pagada`, y no activar el conciliador ante datos legados no verificables.
7. La activación requiere evaluación de índices, observabilidad, límites de tiempo de transacción, rollback y plan de reversión de despliegue.

## Estado de implementación

La rama de trabajo incorpora conciliación de solo lectura y pruebas para importes, duplicados, reversiones, aislamiento de tenant, medio de pago y estado de venta. También dispone de `conciliarVentaCajaLedgerSnapshot`, que usa una sesión y `readConcern: snapshot`, y de una prueba de reversión concurrente aprobada en GRUK CI #1740. **Sigue sin existir protección demostrada de la decisión final contra cambios posteriores al snapshot.** La función histórica `conciliarVentaCajaLedger` aún permite consultas sin sesión; su resultado no constituye prueba de consistencia temporal. No conectar ninguna de las dos funciones a aprobaciones automáticas ni activar el conciliador en producción.
