# Conciliar recepción de ingresos existentes desde la interfaz V81

## Plan y estado comprobado

Revisión del 5 de noviembre de 2026. Padre real `185341119880fbcf92664cb6b86867ab3d448ddc`, árbol `fe10c53952a0e58ce89390bbbf7c627c0ff5dea0`. PR #389 abierto/no fusionado, integración `integration/fp-hormiga-clasificacion-credito-v81`, base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`. #407 abierto. CI del padre: Gate 42117882443, Seguridad 42117882449, V81 42117882458 success; 69/69 Mongo autorizadas. No se presupone el antiguo avance 649ccda3 ni se repite su revisión ya completada.

Un bloque completo seleccionado: consulta propia de ingresos elegibles + selección y confirmación del vínculo/anulación, con recuperación por recibo. Alta nueva de ingreso+recepción en una sola transacción y abonos múltiples siguen pendientes. No llamar al registrador general dentro de otra sesión para aparentar atomicidad.

## Criterios de aceptación

- GET `/calendario-ingresos/:id/recepciones-elegibles?pagina=1` bajo identidad/entitlement personal, solo lectura y no-store. Calendario, cadena, fuente compensada completa y cuentas se observan en snapshot. Máximo 5000 movimientos/cuentas; páginas de veinte sin recortes silenciosos ni selección de dueño desde query. Un error de integridad/capacidad no ofrece cifras parciales.
- Ofrece únicamente ingresos efectivos ACTIVA/COP de caja, no recurrentes, propios, con cuenta propia activa COP, fecha real no futura y a máximo 31 días civiles colombianos de la ocurrencia. Excluye ingresos ya vinculados en cualquier calendario, anulados, gastos, crédito y cobros sintéticos. No infiere recepción por similitud, fecha o importe. No crea movimientos ni cambia saldos.
- La interfaz permite elegir explícitamente un ingreso existente; muestra calendario/ocurrencia, previsto, real, diferencia exacta, fecha en Colombia, cuenta e identidad del movimiento. Motivo y confirmación explícita de cerrar la ocurrencia; nunca programa otro ingreso automáticamente. Sin petición POST al solo consultar o seleccionar página.
- Versión/hash/dueño/cuerpo vinculantes; lecturas incompletas/ajenas y respuestas antiguas o de otra sesión no habilitan cambios. Una revisión financiera cambiada obliga a consultar de nuevo. Doble clic bloqueado; cuerpo/clave guardados antes de enviar, respuesta perdida recuperable por GET y reenvío manual exacto. Se mantienen incertidumbres de otras operaciones.
- Anulación explícita por referencia exacta conserva vínculo/ingreso original y permite volver a revisarlo sin revertir caja. Se permite anular un vínculo de calendario retirado y restaurar después: la referencia del último retiro se conserva a través de la anulación, sin reescribir eventos. Referencias falsas no restauran.

## Verificación prevista y límites

Pruebas puras de filtros, importes/fechas, cuentas, duplicados y capacidad; handler con dueño autenticado/query; UI con texto seguro, revisión, diferencia, cancelación, sesión, páginas/consulta tardía, fallo e idempotencia. Integración HTTP/Mongo autorizada ampliada con controlador/API/agenda reales y DOM simulado: consulta/selección, doble clic, pérdida después de commit y recuperación GET, retiro, anulación de vínculo estando retirado, restauración posterior y conservación de cuentas/transacciones/outbox. Identidad distinta del escenario anterior para respetar el límite de veinte POST por minuto sin desactivarlo ni borrar cuotas.

Campos/eventos/índices/roles/colecciones y backup V18 de 38 colecciones se conservan. No hay provisión, migración, reparaciones ni escrituras de producción. Hashes de eventos previos compatibles; restauraciones anteriores con retiro inmediatamente previo siguen válidas. HTML y recursos personales se versionan juntos `20261105-recepcion-interfaz-v81`.

La lista es una observación, no una reserva del ingreso: el servidor revalida al confirmar y puede guardar una decisión de no aplicación. No prueba frescura de red continua ni aprobación visual en dispositivos reales. La queja de carga/fecha requiere medición productiva real; no se promete carga instantánea.

## Siguiente paso y liberación

Tras CI exacta y evidencia de este bloque: alta nueva atómica de ingreso y recepción, revisión de abonos múltiples y aceptación visual/dispositivos. Verificar de nuevo HEAD, #389/#407, instrucciones y CI antes de actuar; publicar con expected_sha y force=false, sin reemplazar trabajo concurrente. Este documento y CONTINUIDAD_V81.md son el checkpoint de plan/aceptación/evidencias/SHA/siguiente paso.

#407 y criterios globales continúan pendientes de custodio independiente real, backup completo durable/retención/acceso/claves separadas, recuperación operativa en entorno aislado y RPO/RTO reales, roles/índices/históricos de producción, seguridad/aislamiento/exactitud/concurrencia/idempotencia/migración/recuperación, compatibilidad y aceptación de interfaz/dispositivos e informe final trazable. Un ensayo con fixtures no acredita custodia ni recuperación productiva. Sin certificación externa inventada, merge a feature/main, cambios de Empresarial/Blushéa, despliegue parcial Render ni costos nuevos.

Validación local Node24 antes de publicar: módulo 521 casos/512 aprobados/nueve omitidos por servicios externos/cero fallos; 54 dirigidas aprobadas, sintaxis y diff correctos. MongoDB autorizado no disponible localmente; no contar el bloque como verificado hasta obtener CI nativa del SHA publicado.
