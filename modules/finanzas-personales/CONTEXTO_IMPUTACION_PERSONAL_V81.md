# Contexto de decisiones ordinarias de imputación — r133

26/11/2026 Colombia. HEAD real inicial fb54720bda2645c56ed84adc8f4535308bcf4c18/árbol29b80ff846b3cce215d754203dbc15a11bf52d75. Base feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e intacta. PR389 abierto/no integrado, rama integration/fp-hormiga-clasificacion-credito-v81. #407 es issue abierto; cuerpo/cuatro comentarios revisados sin evidencia operativa independiente nueva. CI inicial Gate45872550512/Seguridad45872550537/V8145872550513 success. Instrucciones, continuidad, matriz e informe r132 revisados; sin AGENTS.md adicional en checkout. Fechas de ingreso y compra estricta ya completadas: no repetir.

## Un bloque funcional y aceptación

Aplicar, excluir, anular una decisión y cerrar explícitamente sin aplicar por contexto obsoleto conservan su contrato de imputación SIN movimiento de caja. La captura HTTP es del servidor/dueño JWT, fuera del cuerpo exacto; dominio FP_IMPUTACION_CTX_MIN_V1 separado del cierre de restauración FP_CIERRE_RESTAURACION_CTX_MIN_V1 y de pago/anulación/compensación. GET historial/recibo no captura. El cliente no puede fabricar un evento de restauración mediante la ruta ordinaria.

Se usa el campo privado opcional ya existente en el evento append-only: select:false/serialización privada inmutable. No hay migración/backfill/colección/índices nuevos ni reescritura de firmas históricas. El compromiso contextual queda dentro de firma HMAC y hash encadenado. Verificación selecciona dominio según tipo real de solicitud: contexto ordinario no es válido en cierre de restauración ni contexto de cierre en imputación ordinaria. Restauración aplicada conserva su formato previo. Respuestas nuevas/replay/historial entregan compromiso y resumen minimizado, sin token/claveId/IP/user-agent crudos; recibos mantienen exactamente su contrato/hash vinculado.

Se mueven el primer escritor de serialización y su cursor después de validación pura y captura. Contexto obligatorio para nuevos POST HTTP; configuración ausente503, contexto inválido/dueño/dominio ajeno fallan antes de escribir. Resolver conserva una observación entre reintentos de transacción. Replay verificado sale antes de captura/escritura y no requiere clave contextual actual. Llamadas internas sin callback conservan formato sin contexto. El cierre ordinario sigue requiriendo la cabecera explícita existente y un rechazo verificable; no se inventa una decisión aplicada.

Evento/cursor de imputación y serialización permanecen en transacción atómica. Carrera idempotente agrega un evento; revisionCompatibilidad incrementa exactamente una vez, secuencia/hash financieros y caja/fuentes/compensaciones/outbox permanecen intactos. Omitir o alterar el contexto nuevo invalida la cadena; no hay reparación automática.

## Pruebas y evidencia antes de publicar

Cinco pruebas nuevas y regresiones dirigidas21/21: compatibilidad de HMAC/hash legados (aplicación/cierre), dominio propio/DTO, omisión/dueño/dominio/tamper, captura antes del escritor/retry único, callback ausente/interno/erróneo, replay sin captura, respuesta minimizada y handler. Suite del módulo1082 casos/1073 aprobados/9 omisiones locales por integración no configurada;ci:personal353/349 aprobados/4 omisiones locales por Mongo no configurado; cero fallos/cancelaciones. Sintaxis/diff correctos. Adaptador sintético de interfaz proporciona socket/UA de ensayo, sin inventarlo en producción ni retirar controles existentes.

Mongo autorizado añade las cuatro decisiones por HTTP, legado sin contexto en la misma cadena/BSON idéntico, pago450/capital400, falta de clave antes del cursor, propietario ajeno/cuerpo forjado, rollback después del INSERT, carrera única, recibo/replay sin clave, respuesta/compromiso verificable y privado oculto, cuerpo cambiado409, fuentes/caja intactas y omisión administrativa sintética detectada por historial/replay/GET. Chromium amplía los dos casos de copia de imputación existentes: aplicar/cerrar,503 previo, POST real con respuesta perdida, contexto privado/compromiso/replay/recibo sin clave y recuperación/copia sin doble caja. No se amplían cuotas/casos/timeouts. CI propia pendiente; resultados del padre no acreditan este lote.

## Límites, bloqueos y siguiente paso

El peer socket seudonimizado no verifica cliente detrás de proxy; dispositivo declarado siempre sin verificar. No se afirma cifrado reversible de IP, auditoría de todos los intentos fallidos ni certificación externa. Historia anterior sin contexto se conserva sin inventarlo. La cadena no impide reescritura por un administrador con claves/privilegios completos: hace falta custodia independiente real.

#407 sigue bloqueando producción: custodio/anclas independientes; respaldo durable independiente/retención/accesos/credenciales separadas, restauración aislada y RPO/RTO operativos; roles/índices/migración/configuración reales; dispositivos/Safari/carga, auditoría independiente y compatibilidad/informe final. Ensayos sintéticos no prueban producción ni retención independiente. No merge a feature, main/Empresarial/Blushéa intactos, cero Render/datos reales/costos.

Checkpoint: publicar con expected_sha y force:false sobre HEAD comprobado, verificar CI exacta y cerrar evidencia documental; si cambia HEAD, reevaluar sin sobrescribir. Siguiente bloque independiente: revisar contexto/auditoría y recuperación de retiro/restauración lógica de deudas personales según cobertura existente, antes de modificar. No repetir imputación/restauración/cierre ni fechas/compra estricta completados.


## Fallo inicial y corrección del ensayo

Código inicialf22cdc49be149c7d2f87d98a8de784ae51567351, Gate45878720471/Seguridad45878720467 success; V8145878720542 falló en job140112299476. Mongo107 casos/105aprobados/2fallos (caso y suite padre), sin omisiones: el fixture agotó la cuota de20 solicitudes/minuto de un solo propietario antes de comprobar cuerpo cambiado409 (obtuvo429). Se separan los cuatro escenarios con propietario sintético independiente y su propia cadena mixta legada; ANULAR inicia con decisión previa aplicada. No se cambia producción, límites/cuotas/gates/timeouts ni respuestas esperadas de los casos. Se conservan comprobaciones de captura, rollback, carrera, cadena, privacidad, fuente/caja y recibos/replay sin clave. CI propia del SHA corregido pendiente.


## Verificación del código corregido y checkpoint

Código2ef326292bee19ff23aaec46bd6be538315a8e5d/árbold3c622fe21583909b1e58f2eb96ca68abf85981b. Tres workflows propios success: Gate45879073716, Seguridad45879073750, Precisión/Integridad45879073712;13 jobs completados/success. Job autenticado140113486041: Mongo107/107 y Chromium/backend32/32, cero fallos/omisiones/cancelaciones. FP_CONTEXTO_IMPUTACION_MONGO aparece para APLICAR/EXCLUIR/ANULAR/CIERRE con propietarios independientes/cadena mixta, carrera/rollback, recibos y fuentes/caja intactos; FP_CONTEXTO_IMPUTACION_BROWSER aparece para aplicada/no aplicada con login/HTTP/Chromium390 reales,503 previo, respuesta perdida y recuperación/copia sin doble caja.

Precisión de evidencia: en Mongo la adulteración administrativa por omisión del campo se ejerce en CIERRE; los otros escenarios verifican cadena/firma y conservación, además de los vectores unitarios de omisión. El cierre corrige únicamente el marcador del fixture a omisionRechazadaEnEsteEscenario=cierre; no cambia comportamiento ni afirmaciones esperadas. No atribuir ese ataque real a los cuatro escenarios por separado. El descendiente de cierre requiere su propio CI.

Copia/restauración sintética del mismo job:45 colecciones/8180 documentos/8360770 bytes,captura266ms/restauración1028ms/edad1257ms; custodiaIndependiente=false,rpoProduccion=false. No acredita respaldo durable independiente, retención/accesos ni RPO/RTO operativo de producción. Fuentes deliberadamente corruptas de ensayo no se certifican semánticamente por copiar BSON.

Un bloque funcional completo de GitHub, sin desplegar ni integrar. Fallo inicial429/corrección conservados arriba; sin cambios de cuotas/gates. Siguiente ejecución debe comprobar HEAD/CI del cierre, instrucciones/matriz/#407 y revisar auditoría/contexto y recuperación de retiro/restauración lógica de deudas personales según cobertura existente. #407/custodio/respaldo/operación/dispositivos/auditoría real siguen pendientes. Base652126a intacta; cero Render/datos reales/costos, tarea activa.


Corrección del cierre20d88f33545bdc619916caae77a514d5c33e7b05: job140116047678/V8145879824939 detectó ReferenceError en el marcador (cierre tenía alcance solo en el bloque previo); Mongo107/105aprobados/2fallos incluido padre, navegador autenticado no ejecutado. Se usa directamente tratamiento===CIERRE, parámetro del escenario. Comportamiento productivo y todas las aserciones intactos; no se presenta20d88f33 como verificado. Requiere CI completa del descendiente corregido.
