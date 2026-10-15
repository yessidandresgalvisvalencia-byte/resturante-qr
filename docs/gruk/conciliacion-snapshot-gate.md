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

## Contrato de autorización de órdenes financieras (pendiente de implementación)

El resultado `CONCILIADA` —incluso con `consistencia: SNAPSHOT`— es evidencia de lectura, **no** un permiso para ejecutar cobros, devoluciones, ajustes, transferencias ni asientos.

1. La orden debe identificar `empresaId`, `sedeId`, `ventaId`, `actorId`, alcance de rol, operación, importe exacto en unidades menores y clave de idempotencia.
2. El ejecutor debe validar autenticación y autorización de tenant/rol antes de abrir la transacción, y volver a comprobar el estado financiero dentro de la misma transacción que persiste el efecto.
3. Una reversión y una aprobación que afecten a la misma venta deben competir por **un documento de control compartido** mediante escritura condicional/CAS, con versión o estado esperado. Solo leer snapshot no previene write skew cuando las escrituras son disjuntas.
4. Si el CAS no coincide, falta el asiento, existe reversión o cambió el importe, abortar la transacción completa. Reintentar solo la operación entera con la misma clave de idempotencia y política acotada para errores transitorios.
5. Registrar una única obligación durable de outbox dentro del commit, sin emitir efectos externos antes del commit. Los consumidores deben ser idempotentes.
6. Probar carreras en ambas direcciones (reversión primero y aprobación primero), fallo después de escritura parcial, doble clic, reintentos, tenant cruzado y replay tras timeout. No conectar rutas ni activar órdenes hasta que esas pruebas aprueben.

**Nota de implementación:** el actual `conciliarVentaCajaLedgerSnapshot` crea y cierra su propia sesión. No reutilizar ese resultado para autorizar una transacción distinta; el ejecutor necesita un contrato separado con la misma sesión y una escritura CAS compartida por todos los caminos que revierten/aprueban.
