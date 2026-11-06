# Abonos de ingreso y cierre explícito V81

## Plan y estado comprobado

Revisión del 5 de noviembre de 2026, hora Colombia. Padre real `c058891c1a3dd6405cded331be93bb7d2af0cdeb`, árbol `9c75cd2066f2da572d88545234270a2f5b1a6fc2`. #389 abierto/no fusionado, integración `integration/fp-hormiga-clasificacion-credito-v81`, base `feature/finanzas-personales` SHA `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 abierto. Gate 42135045799, Seguridad 42135045742 y V81 42135045699 del padre success, Mongo autorizado 70/70. Instrucciones/documentación/pendientes revisados antes de modificar.

Un bloque seleccionado: recepciones parciales/múltiples de una ocurrencia, cierre explícito sin dinero adicional e integración con horizonte, proyección, formularios y recuperación. Antes solo se admitía cerrar con un único ingreso; registrar un abono no debía confundirse con confirmar la previsión entera.

## Contrato y criterios de aceptación

- VINCULAR_RECEPCION y REGISTRAR_RECEPCION conservan su contrato, salvo `cerrarOcurrencia`: ahora exige booleano explícito. `false` declara abono abierto; `true` da por terminada la recepción con ese ingreso. Históricos `true` conservan significado y hash; no se migra ni reescribe. No se aceptan textos, números o valores omitidos para esa decisión.
- Abonos abiertos permiten otros ingresos propios distintos en la misma ocurrencia. Cada fuente financiera solo puede estar en un vínculo activo del usuario, incluso entre calendarios. Las claves/versiones/orden global existentes controlan reintentos y carreras. La suma usa BigInt y solo expone enteros seguros; desbordamiento aborta, nunca redondea.
- `montoRecepcionMinor` suma vínculos activos de la ocurrencia; su diferencia contra lo previsto es una comparación, no un saldo garantizado por cobrar. No se crea `saldoPorRecibirMinor` ni se supone que llegará la diferencia. Los importes vinculados con fuente posteriormente compensada requieren revisión; no se presentan como saldo actual verificado.
- Una recepción parcial marca `recepcionPendienteCierre`. Home conserva ingresos efectivos de ledger/caja, pero el horizonte queda desconocido con motivo RECEPCION_PARCIAL_SIN_CIERRE. Proyección rechaza la previsión incompleta, también por su helper de fechas; no suma el monto previsto original ni inventa el restante para autorizar gasto.
- FINALIZAR_RECEPCION requiere confirmación, motivo, versión y referencia exacta de un abono activo de la ocurrencia (`ocurrenciaFecha,versionVinculo,vinculoHash`). Agrega un evento/cierre protegido y recibo `afectaCaja:false`; no crea ingreso, saldo ni outbox financiero. Un ingreso posterior puede igualmente cerrar con `cerrarOcurrencia:true`. No se programa el mes siguiente.
- Los cierres conservan la referencia a su abono base. Anular ese vínculo conserva fuente/dinero/cierre histórico y deja la ocurrencia pendiente si quedan abonos sin otro cierre válido. Volver a vincular una fuente exige nueva confirmación y versión, sin duplicar caja. El retiro/restauración existente sigue conservando eventos.
- Si una compensación cambia la fuente entre revisión y cierre, el servidor guarda una decisión no aplicada con la misma clave/orden transaccional. El cliente valida dueño/ruta/huella/versión/motivo y resuelve solo esa petición; no libera otras incertidumbres. Fallos de infraestructura/integridad no se convierten en rechazo definitivo.

## Interfaz e integración

Ingreso existente ofrece Vincular como abono o vínculo con cierre explícito. El formulario de alta nueva exige elegir PARCIAL/FINAL, sin opción implícita. La lista muestra parcial/total vinculado y explica que no confirma dinero por recibir ni autoriza gasto desde la previsión. Finalizar con lo recibido revisa referencia y no mueve caja. Motivo, campos, clave y cuerpo se conservan antes de POST; GET recupera respuestas perdidas y cambios de sesión/revisión descartan vistas anteriores.

El HTML anterior sin el selector nuevo falla cerrado sin detener la app ni tocar bitácora. HTML/recursos personales se versionan juntos `20261105-recepcion-parcial-v81`. Cliente anterior puede no manejar parciales y debe recargarse; los contratos anteriores `true` se conservan y el servidor no habilita previsión con abonos abiertos.

## Pruebas del lote

Local Node24: módulo 536 casos/527 aprobados/nueve omitidos por servicios externos/cero fallos; 69 dirigidas aprobadas, sintaxis/diff correctos. Casos: reconstrucción histórica, varios abonos, total exacto, cierre, anulación de su base, fuente repetida, referencia falsa, cierre coercible, desbordamiento, horizonte desconocido y proyección bloqueada, selección explícita de modo y cuerpo recuperable. CI nativa del nuevo SHA pendiente al preparar el lote, sin contar omisiones locales como aprobación.

Nuevo escenario HTTP/Mongo autorizado sobre formularios/control/API reales con DOM simulado: alta de abono con respuesta perdida/GET, vínculo de segundo abono, cierre con respuesta perdida/GET sin cambios de cuenta/ledger/outbox, anulación/revínculo sin dinero extra, compensación concurrente y decisión no aplicada recuperable, originales intactos y dos claves de abono compitiendo sin ingreso huérfano. Preserva límites, roles e índices y no usa cuentas reales.

Misma colección de eventos Mixed, modelos/índices/roles y backup V18/38; no hay migración, provisión, reparación ni borrado de producción. Estados/recibos previos conservan hashes. El total vinculado no sustituye conciliación bancaria ni aporta custodia independiente.

## Límites y siguiente paso

Cierre es declaración del propietario, no prueba de cumplimiento por pagador. La recepción parcial no es deuda por cobrar ni garantía del restante. DOM simulado no es aprobación visual en iPhone/Redmi/PC/Mac. Carga/fecha requieren medición real pendiente; sin promesa de inmediatez o pérdida imposible.

Tras CI exacta: revisar pendientes de recuperación/seguridad del módulo, estados de deudas/ahorro/conciliaciones y aceptación operativa/visual, sin repetir bloques ya verificados. Verificar HEAD/#389/#407/instrucciones/CI antes de actuar; publicar con expected_sha/force=false. Plan/aceptación/evidencias/SHA/siguiente paso quedan aquí y en CONTINUIDAD_V81.md.

#407 sigue abierto: custodio independiente real, backup durable completo/retención/acceso/claves separados, recuperación operativa/RPO/RTO reales, roles/índices/históricos de producción, seguridad/exactitud/concurrencia/idempotencia/migración/aislamiento/recuperación, compatibilidad/dispositivos e informe final trazable. Ensayos aislados no acreditan custodia o recuperación productivas. Sin merge a feature/main ni Render, cambios en Empresarial/Blushéa, costos nuevos o datos reales.
