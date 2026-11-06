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


## Cierre verificado del lote 55

Núcleo `11a5f94d87ef323c260b1206c616b604ea4865ff`, árbol `d9305bfc30f8c33909165b2816deb6e07e819749`, padre real 6e7b6038c60125899437472c1032ab8a2b03f721. Ocho archivos del lote cotejados por SHA remota, árbol local idéntico. Ref de integración actualizada con expected_sha exacto y force=false; base feature intacta, sin ejecución concurrente detectada.

CI exacta del núcleo toda success: [Gate 42165419381](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42165419381), [Seguridad 42165419344](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42165419344), [V81 42165419338](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42165419338). [Mongo autorizado job 127720636881](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42165419338/job/127720636881): 75/75, cero fallos/omisiones; nuevo escenario de próxima cuota aprobado. También Mongo transaccional, Redis concurrente, pruebas generales y seguridad aprobados.

Evidencia nativa: préstamo/calendario vinculado 700 se proyecta una sola vez en 30/60/90. Pago real 100 produce pendiente 600 en Home/proyección, caja 900, colchón 90 y disponible 210. Metadatos conservan cuota pactada 700 y pendiente derivado 600. Anulación vuelve a 700/caja 1000, restauración a 600/caja 900. Pago histórico 200 deja pendiente 400 sin mover caja. UNICA confirmada adicional 300 suma total 700 sin inferir cuotas siguientes. Fuente original y calendario conservados, snapshots iguales antes/después de consultas.

Tras Home, un escritor confirma otro abono histórico de 50: la proyección en curso conserva 700 en su snapshot y la nueva consulta devuelve 650. Propietario ajeno no obtiene deudas/pagos. Falla de fuente compensada aborta la proyección y Master muestra ventanas=null, sin cantidades parciales o mensaje privado de la excepción. Estas pruebas no cambian datos reales.

Local Node24: 562 casos/553 aprobados/nueve omitidos/cero fallos; 26 dirigidas aprobadas; suite CI local 338 casos/334 aprobados/cuatro omitidos/cero fallos; sintaxis/diff correctos. La prueba anterior del texto del acumulador ahora verifica resultados reales 670 y rechazo de duplicados; no se desactiva ningún gate.

Backup/restauración V18 del mismo job: 38 colecciones, 5480 documentos, 3708642 bytes; captura 215 ms, restauración 954 ms, edad 1113 ms. CustodiaIndependiente=false, rpoProduccion=false. Son métricas de fixtures aisladas, no evidencia de backup durable/retención/custodio real ni RPO/RTO o recuperación de producción.

Un bloque funcional completado en GitHub: pendiente de próxima cuota coherente con Home y pagos compensados del mismo snapshot, con deduplicación de calendario, recuperación de fuente, aislamiento y fallos verificados. El cierre documental necesita CI de nuevo en su SHA exacto; HEAD y resultado final quedan en #389. Sin merge a feature/main ni Render.

Checkpoint siguiente: verificar HEAD/#389/#407/instrucciones/CI; revisar imputación temporal por ciclo y cambio de fecha/vencimiento para no usar un pago de período anterior en una cuota nueva sin evidencia explícita. La suma mensual actual no acredita identidad de todos los ciclos ni amortización externa; aceptación temporal integral sigue pendiente. Continuar reservas de tarjetas/gastos recurrentes y matriz de recuperación/conciliación/seguridad. #407/custodia independiente/backup durable/recuperación operativa/permisos-índices-históricos/dispositivos/compatibilidad/informe final abiertos; carga/fecha productiva aún sin medición real suficiente. No levantar gates, aumentar costos ni modificar información real.
