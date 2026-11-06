# Próxima cuota proyectada con abonos compensados V81

## Estado comprobado y plan

Revisión del 5 de noviembre de 2026, Colombia. HEAD real inicial `6e7b6038c60125899437472c1032ab8a2b03f721`, árbol `81b11fd3b1ee8a6b6fa5ef8c461e7c9e2934cbce`. #389 abierto/no fusionado, integración personal con base feature/finanzas-personales `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 abierto. Tres workflows del padre success: Gate 42160336207, Seguridad 42160336219 y V81 42160336286. Mongo autorizado 74/74. Instrucciones, checkpoint y pendientes revisados; no AGENTS.md adicional en el árbol.

Un bloque seleccionado: coherencia de la próxima cuota proyectada con el pendiente de Home después de abonos. La proyección anterior sumaba cuotaMinor completa sin leer pagos compensados; por ejemplo, conservaba 700 aunque saldo y pendiente real de esa cuota fueran 600. El calendario vinculado debe conservar el importe registrado original sin duplicar la cuota de deuda.

## Contrato y criterios de aceptación

1. Home y proyección comparten sumarPagosPrestamoPeriodo: entradas del mismo mes civil colombiano, hasta el corte inclusivo, solo PAGO_DEUDA con prestamoId. Valida propietario, identidad de fuente y préstamo, ausencia de duplicados, estado ACTIVA, COP, impactoCaja booleano, capital positivo seguro y fecha válida del período. Usa montoPagadoRealMinor cuando está informado; para fuente anterior sin ese campo conserva montoMinor como pago real conforme al contrato existente. Los pagos históricos sin caja también reducen obligación; no crean dinero.
2. La suma por préstamo usa BigInt y rechaza desbordamiento antes de convertir a Number. Un pago de otra deuda o de compromiso sin prestamoId no reduce el pendiente de esta. Una fuente anulada se excluye mediante la lectura compensada, no mediante modificación del original.
3. Proyección obtiene Home, deudas, calendarios, referencias y pagos compensados en la misma transacción snapshot/primary y con el mismo corte. No consulta otra cuenta, otro propietario, fecha futura ni otro snapshot para completar el resultado. Conserva capacidad verificable y falla sin entregar totales parciales cuando la fuente no se puede verificar.
4. Pendiente proyectado usa saldoCuotaPendienteMinor de Home: min(saldo vigente, max(0, cuota pactada − pago real aplicado)). Mantiene corrección de última cuota del lote anterior. Una obligación UNICA confirmada sin cuota explícita usa su saldo restante; sin confirmación no se inventa principal exigible y se mantiene pendiente de definir.
5. Una cuota cubierta por los abonos considerados no vuelve a aparecer ni programa automáticamente las siguientes. Se cuenta en cuotasCubiertasPorAbonos para distinguirla de ausencia de fuentes. Los calendarios vinculados se validan contra su declaración original y se deduplican frente a la deuda; nunca se reescriben.
6. Contrato de proyección 2 mantiene alcance parcial: solo próxima cuota registrada, ventanas 30/60/90, saldoCondicionalMinor=null, autorizaGasto=false y completo=false. No se genera amortización futura ni garantía de caja. cuotaMinor continúa siendo importe pactado; pendienteProximaCuotaMinor presenta la diferencia derivada y pagosPrestamoAplicados permite rastrear fuentes propias consideradas.
7. Consulta no modifica cuenta, préstamo, fuente financiera, calendario, compensaciones ni outbox. Anulación/restauración de pago deben cambiar la siguiente observación de manera coherente, manteniendo fuente original y eventos intactos. Escritura concurrente posterior a Home no puede mezclar el pendiente nuevo con fuentes viejas.

## Validación del lote al preparar publicación

Local Node24: módulo 562 casos/553 aprobados/nueve omitidos por servicios externos/cero fallos; 26 dirigidas aprobadas; suite npm test:finanzas-personales 338 casos/334 aprobados/cuatro omitidos por Mongo externo/cero fallos; sintaxis/diff correctos. No se cuentan omisiones como aprobación nativa.

Casos nuevos: última cuota parcial 600 en los tres horizontes sin duplicar calendario 700; cuota ordinaria parcial, pago real mayor que capital, pago histórico, cuota cubierta sin inventar siguientes, UNICA confirmada sin cuota separada y fuente incompleta/no confirmada, otra deuda, identidad ajena, duplicados, moneda/estado/fecha inválidos, período colombiano y desbordamiento.

La prueba existente que exigía el texto exacto del antiguo acumulador se sustituye por comprobar que el mismo conjunto de pagos reales suma 670 por la deuda correcta y rechaza una fuente duplicada. Conserva su comprobación del cálculo compartido; ningún test/job/gate se desactiva.

Nuevo escenario Mongo autorizado pendiente de CI del nuevo SHA: cuota propia y calendario vinculado 700; pago real 100 deja pendiente 600, caja 900, colchón 90 y Disponible Hoy 210. Anular restaura pendiente 700/caja 1000; restaurar vuelve a 600/caja 900 conservando original. Pago histórico 200 deja 400 sin mover caja; obligación UNICA adicional 300 produce total 700. Escritor concurrente agrega otro abono histórico 50 después de Home: proyección en curso debe seguir en 700; nueva observación 650. Fuentes ajenas aisladas, snapshots de consultas iguales, fallo de lectura compensada sin totales parciales ni datos privados. El calendario original se conserva en todos los pasos.

## Alcance y límites temporales

Se conserva el criterio de abonos del período actual que usa Home; no se atribuyen pagos de meses anteriores o futuros a cuotas nuevas ni se reconstruyen ciclos faltantes. Los períodos/ciclos de deuda todavía requieren su aceptación integral, particularmente cuotas de otro mes o calendario cambiado. No se afirma que una suma mensual pruebe acuerdos de imputación o amortización externa. No se proyectan automáticamente todas las cuotas de una deuda.

Sin modelos/índices/roles/credenciales nuevos, migración, reparación, borrado, restauración destructiva ni escrituras sobre producción. Pruebas de fixtures no sustituyen custodia independiente, permisos efectivos de producción ni recuperación operativa.

## Checkpoint

Tras CI exacta: revisar identidad temporal de pagos/cuotas cuando cambia el período o el vencimiento, para no imputar un abono del ciclo anterior a la cuota siguiente sin evidencia. Continuar reservas de tarjetas/gastos recurrentes y matriz de recuperación/aislamiento/conciliación según prioridad. Verificar HEAD/#389/#407/instrucciones/CI antes de retomar; usar expected_sha/force=false. Evidencias, SHA, árbol, resultados y siguiente paso aquí y en CONTINUIDAD_V81.md; cierre documental también requiere CI exacta.

#407 abierto: custodio independiente real, backup durable/retención/acceso separado, recuperación operativa y RPO/RTO, permisos/índices/históricos de producción, seguridad/exactitud/concurrencia/idempotencia/migración/aislamiento/recuperación y dispositivos/compatibilidad/informe final. Carga/fecha del servicio publicado siguen sin medición real suficiente. Sin merge a feature/main ni Render, otros productos, costos nuevos o datos reales modificados.
