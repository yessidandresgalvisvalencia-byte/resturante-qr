# Obligaciones ya contempladas en el plan V81

## Estado real y plan del lote 54

5 de noviembre de 2026, Colombia. HEAD real antes de actuar `afc0b33b0fe6f69504e88f18ec7ffa9275fbc0b9`, árbol `3e5ca432ee8dc703807e52ffd818ad78fb588dd3`. #389 abierto/no fusionado, integration/fp-hormiga-clasificacion-credito-v81 con base feature/finanzas-personales `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 abierto. CI del padre success: Gate 42153689263, Seguridad 42153689239, V81 42153689312; Mongo autorizado 73/73. Se revisaron instrucciones/checkpoint, Home, validador compartido, evaluación de obligaciones y flujos de corrección/pago/reversión. No hay AGENTS.md adicional en el árbol.

Un bloque seleccionado: evaluación de una obligación identificada cuyo importe ya está contemplado en los compromisos descontados al calcular Disponible Hoy. La comparación sin referencia del lote anterior conserva su alcance: disponible libre y obligaciónYaReservada=NO_VERIFICADO. No es un error de escritura del ledger; faltaba vincular la comparación con evidencia de identidad para no exigir el mismo importe de nuevo al evaluar.

Preparación local: se recuperó el checkout desde el árbol remoto comprobado reuniendo objetos Git locales, sin cadenas profundas de alternates. No se alteró ninguna rama remota durante esa recuperación ni se usaron datos productivos.

## Contrato y aceptación

1. Home identifica cada compromiso de préstamo propio con tipo PRESTAMO y deudaId; tarjetas con tipo TARJETA_CREDITO conservan su identidad separada. Importe, fórmula, saldo, colchón y suma de compromisos no cambian. No se crea una reserva contable nueva.
2. Entrada opcional prestamoId exige cadena ObjectId exacta; no admite monto reservado, identidad del propietario ni campos desconocidos. El dueño sigue siendo el JWT. Conversación con deuda resuelta y monto explícito usa su identidad; sin referencia mantiene comparación conservadora anterior. No se vincula por coincidencia de monto o concepto.
3. El resolutor comprueba listado de compromisos de Home contra su composición en explicaciones.disponibleHoy.origen, ambos del mismo snapshot. Verifica fechas exactas entre corte e ingreso, montos positivos seguros, suma BigInt igual a gastosFijosAntesProximoIngresoMinor, identidad tipada única y composición idéntica. También exige autorización del validador compartido de Disponible Hoy. Sin evidencia completa o referencia propia en ese horizonte: FALTAN_DATOS y sin cálculo/recomendación/reserva.
4. Reserva registrada significa descuento en el plan, no dinero separado ni pago realizado. Si el conjunto está en rojo, no se asigna cobertura a esa deuda: REQUIERE_PLAN, faltante global identificado, sin faltante individual inferido ni recomendaciones/alternativas.
5. Con cobertura global, solo se compara max(0,importe informado − importe reservado) contra el disponible libre existente. Lo cubierto por la reserva queda YA_CONTEMPLADA. No se vuelve a descontar ese importe, ni se suma la reserva a Disponible Hoy. Una consulta de pago parcial no libera el remanente.
6. Alternativas de la misma obligación conservan requisitos explícitos y comparación exacta del lote anterior; su pago actual se compara solo por el incremento sobre la reserva identificada. El total/costo externo no se reduce por la reserva; se expone importeAdicionalAhoraMinor y no se confirma acuerdo externo. Impuestos/cargos deben estar incluidos en importes informados.
7. Respuestas siguen hasta seis líneas, semáforo y una sola acción. Solo lectura, afectaCaja=false, autorizaPago=false, ingresoGarantizado=false. Sin mutación de cuenta, deuda, pagos, compensaciones, outbox ni historial por consultar. Una consulta es observación del corte, no orden de pago ni reserva transaccional.

## Comportamiento esperado y evidencia local

Caso: saldo 1000, colchón 100, compromiso 700 => Disponible Hoy 200. Sin referencia, comparar obligación 700 conserva REQUIERE_PLAN/faltante 500. Con referencia comprobada, 700 está YA_CONTEMPLADA, incremento cero y disponible sigue 200. Informar 750 compara solo 50 adicionales. Informar 100 no libera los 600 restantes ni aumenta el disponible. Si monto 1000 y alternativa con pago actual 800/costo extra 20, el incremento es 100; costo total sigue 1020.

Local Node24: módulo 553 casos/544 aprobados/nueve omitidos por servicios externos/cero fallos, 108 dirigidas aprobadas, sintaxis/diff correctos. Nuevas pruebas de identidad/procedencia, importes exactos, referencia ausente/ambigua, composición/suma/fecha discordante, saldo rojo, campos de cliente prohibidos, alternativas y ausencia de mutaciones.

Nuevo escenario HTTP/JWT/Mongo autorizado pendiente de CI al preparar el lote: cuota propia 700, disponible 200, referencia ajena e inexistente indistinguibles, conversación de deuda identificada, corrección auditada 700→600 y regreso, pago real 700, anulación compensatoria y restauración del mismo original. Las consultas deben conservar snapshots de cuenta/deuda/transacciones/outbox/calendario/correcciones/compensaciones. Una fuente ya pagada no tiene reserva vigente para volver a usar; al anular el pago se vuelve a leer la reserva actual. Se preserva el original financiero en todo el ciclo.

No hay migraciones, reparación, limpieza, cambios de modelos/índices/roles/credenciales/backup ni escritura sobre producción. No se cambia la fórmula o el seguimiento de cuotas; la evaluación usa la reserva que Home verifica en ese corte. No se convierte una explicación en certificación externa o garantía de cobertura futura.

## Checkpoint y límites

Tras CI exacta: revisar compromisos de tarjetas y gastos recurrentes con identidad de origen, para extender reconocimiento de reservas solo con evidencia equivalente; no admitir IDs genéricos o liberar reservas automáticamente. Continuar recuperación/conciliación y matriz de aceptación. Verificar HEAD/#389/#407/instrucciones/CI antes de retomar y publicar con expected_sha/force=false. Guardar SHA/árbol/workflows/resultados aquí y en CONTINUIDAD_V81.md; el cierre documental también necesita CI exacta.

#407 abierto: custodia independiente real, backup durable/retención/acceso separado, recuperación operativa y RPO/RTO, roles/índices/históricos de producción, aceptación integral de seguridad/exactitud/concurrencia/idempotencia/migración/aislamiento/recuperación, dispositivos/compatibilidad/informe final. Carga/fecha del servicio publicado siguen pendientes de medición real. Sin merge a feature/main ni Render, otros productos, costos nuevos o datos reales modificados.


## Cierre comprobado del lote 54

Núcleo `c8b2514ffd3a3f5e763f713343eb33af2f90d813`, árbol `d5833f3feaeee36ec9fcf6117daf1cd740d3cef1`, padre real afc0b33b0fe6f69504e88f18ec7ffa9275fbc0b9. Nueve archivos cotejados con SHA remota y árbol local idéntico. Integración actualizada con expected_sha exacto/force=false, sin cambio de base ni ejecución concurrente detectada.

CI del núcleo toda success: [Gate 42159479663](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42159479663), [Seguridad 42159479710](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42159479710), [V81 42159479662](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42159479662). [Mongo autorizado job 127701451736](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42159479662/job/127701451736): 74/74, cero fallos/omisiones, escenario nuevo aprobado. Transacciones MongoDB, Redis concurrente y pruebas generales aprobadas.

Resultados nativos: reserva de préstamo 700 y disponible libre 200. Referenciar la cuota devuelve YA_CONTEMPLADA con incremento cero; importe 750 compara 50 adicionales. Consultar importe 100 no libera el remanente ni aumenta 200. Referencia ajena o inexistente devuelven exactamente el mismo resultado no verificable, sin reserva ni datos ajenos; monto reservado aportado por cliente se rechaza 400. Conversación identifica la deuda y mantiene seis líneas/una acción.

Corrección auditada 700→600 cambia la reserva a 600, incremento a 100 y disponible a 300 en nueva observación, sin reusar monto anterior; el evento original de corrección conserva cuota 700. Después de pago real 700, la caja queda 300 y no existe reserva para reutilizar. Anulación compensatoria restaura caja 1000 y reserva 700; restauración del mismo pago deja caja 300 y reserva ausente. En cada consulta snapshots de cuentas/deuda/fuentes/outbox/correcciones/compensaciones permanecen iguales. La transacción original de pago se conserva íntegra.

Se añade compatibilidad de conversación con el concepto de préstamo válido de hasta 160 caracteres: solo su presentación para este evaluador se limita a 140, sin cambiar la deuda ni su identidad. Prueba dedicada aprobada. Validación local final: 554 casos/545 aprobados/nueve omitidos por servicios externos/cero fallos, 109 dirigidas aprobadas, sintaxis y diff correctos. El cierre incluye ese ajuste y requiere nueva CI de SHA exacto; resultado final queda en #389.

Ensayo backup V18 del núcleo: 38 colecciones, 5460 documentos, 3686942 bytes; captura 159 ms, restauración 1280 ms, edad 1403 ms. CustodiaIndependiente=false y rpoProduccion=false: métricas aisladas, sin acreditar backup durable, retención/custodio independiente o RPO/RTO/recuperación de producción.

Un bloque funcional completado en GitHub: obligación identificada ya contemplada, sin doble comparación de reserva, con API/conversación y recuperación de fuente compensada verificadas. No es pago, escrow ni modificación de Disponible Hoy. Sin merge a feature/main ni Render.

Checkpoint siguiente: verificar HEAD/#389/#407/instrucciones/CI; evaluar identidad de reservas de tarjetas/gastos recurrentes solo con evidencia equivalente y sin liberar fondos automáticamente. Mantener matriz de recuperación/aislamiento/conciliación y aceptación. #407/custodio/backup durable/recuperación operativa/permisos-índices-históricos/seguridad/dispositivos/compatibilidad/informe final continúan abiertos; carga/fecha publicada sin medición suficiente. No desactivar gates, contratar servicios ni modificar datos reales.
