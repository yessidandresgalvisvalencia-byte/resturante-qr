# Contexto de aprobación conversacional — r103

19 de noviembre de2026 (Colombia). Base remota comprobada25801c4839fba83519797b494a3cc426a097296a, árbol e671bc000754f3303bac525f5733eafd72f22b33. PR389 abierto hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e; Gate44539013313/Seguridad44539013316/V8144539013404 success. #407 abierto. Fechas/condiciones estrictas de compra ya documentadas en HORIZONTE_INGRESO_V81.md y EVALUACION_OBLIGACIONES_VERIFICADA_V81.md; no repetir ese trabajo como bloque nuevo.

## Bloque y plan

Un bloque funcional: contexto minimizado del acto de aprobar un borrador (completo o por elemento), ligado a su recibo INSERT-only y fuentes originales. Es un acto distinto de capturar/clasificar texto; no reutiliza el contexto r102 ni afirma que una captura fue aprobación.

1. Dominio FP_APROBACION_CTX_MIN_V1 con clave contextual dedicada, separada de autenticación/datos; HMAC por dominio/dueño/día/peer del socket, sin confiar en XFF. User-Agent reducido a familia/navegador declarados no verificados. Ambas rutas de aprobación pasan capturador exclusivo del servidor; metadatos contextuales forjados en cuerpo400. El propietario continúa viniendo del JWT, ignorando selectores de usuario enviados por cliente.
2. Captura diferida después de validar solicitud, versión y candidatos y resolver replay, antes de escribir caja/fuentes. HTTP nuevo sin configuración válida falla503 sin efectos. El aprobador interno declara INTERNO_SIN_RED. Campo privado opcional/select:false auditoriaContexto en el recibo; serialización normal lo excluye. No se copia a transacciones, préstamos, cuentas, outbox, borradores o resultado.
3. Hash agrega compromiso contextual únicamente cuando existe, conservando vector/algoritmo legado sin reescritura. Recibo liga propietario/borrador/alcance/versión/elementos, declaración original, operaciones y fuentes originales según contrato existente. Búsqueda/GET/replay solicitan privado y verifican contexto/recibo/fuentes antes de devolver resumen. GET/replay no requieren clave contextual actual ni recapturan. Contexto alterado/ausente/ajeno/de otro dominio o DTO público como evidencia privada bloquean recuperación.
4. El contexto se inserta con recibo, cambios de borrador, fuentes financieras, caja y outbox dentro de la misma transacción de aprobación. Se mantienen validaciones, índices únicos por solicitud/elementos, importes exactos y filtros de saldo. Rotar clave solo afecta aprobaciones nuevas. No cambia algoritmo de contabilización ni crea asiento extra para auditar.
5. Resumen público/compromiso estrictos, sin token/IP/ID de clave. Control de pendientes y API verifican metadatos antes de cerrar una operación incierta; el visor muestra Aprobación observada y dispositivo declarado no verificado, tanto en respuesta como al consultar recibo. Recibo histórico no acredita banco, saldo actual ni hechos posteriores. CapturadoEn observa solicitud de aprobación, no fecha real del hecho relatado ni una certificación de identidad.
6. RespaldoV31/44 compatible V30 y anteriores, mismas25 colecciones protegidas/roles/índices. Sin migración, nuevas colecciones, TTL, limpieza, backfill o restauración productivos. Recursos personales20261119-contexto-aprobacion-v81 publicados juntos; conservar pendientes/diarios si un cliente anterior necesita actualizar.

## Criterios de aceptación

| Criterio | Evidencia requerida |
| --- | --- |
| Origen/privacidad | Dueño JWT, dominio distinto de captura y peer no XFF; forja/configuración ausente/ajeno rechazados; resumen, JSON, consultas normales y outbox sin privado |
| Integridad/compatibilidad | Vector hash previo idéntico, recibo legado sin contexto inventado; contexto incompleto/alterado/ajeno o dominio equivocado bloquea lectura/replay sin reparar |
| Exactitud/atomicidad | Carrera contabiliza una vez; fallo después del INSERT revierte caja/fuentes/outbox/borrador/recibo/contexto juntos; contexto no mueve dinero |
| Recuperación/rotación | GET/replay sin clave actual conservan snapshot; versión/alcance distintos409; rotación conserva recibos anteriores; lote, elemento/parcial e interno cubiertos en ensayo |
| Interfaz integrada | Login/HTML/API/Mongo autorizado, captura real previa, aprobación con respuesta perdida, un POST/consulta de recibo sin repetir débito, contexto distinto y caja/fuentes intactas390 |
| Trazabilidad/operación | SHA/tree/CI exactos, pruebas normales/fallos, métricas aisladas/límites y siguiente paso en informe/matriz/continuidad; gates intactos |

## Validación previa a publicar

Local: módulo909 casos/900 aprobados/9 omisiones/0 fallos; ci:personal353/349 aprobados/4 omisiones/0 fallos. Dirigidas recibos/control/respaldo45/45 y contexto4/4 (solapadas, no sumar). Sintaxis de helper autorizado y harness aprobada. Mongo autorizado/Chromium/CI del SHA nuevo pendientes; omisiones locales no sustituyen integración. No se aumentan timeouts ni se omiten controles.

## Límites y bloqueo de liberación

El contexto pertenece al recibo de aprobación, no agrega auditoriaRegistro al asiento financiero ni una cadena global nueva. Las fuentes/instantáneas del recibo mantienen el alcance previo: transacciones deben coincidir; cuentas/préstamos mutables se verifican como fuentes existentes, no como saldo vigente idéntico al pasado. Otros flujos dedicados de deuda/crédito y sus ciclos/altas siguen pendientes de contexto en su propio alcance. Captura e interpretación r102 siguen separadas.

Select:false/transform/resumen no son cifrado ni permisos Mongo por campo. El compromiso público no permite revalidar por sí solo toda la evidencia privada. Un administrador que reescriba coherentemente recibo/contexto/fuentes sigue fuera de la prueba local; custodia independiente real y auditoría aplicable pendientes. No se certifica recuperación garantizada ni superioridad absoluta.

Persisten #407/matriz: custodio independiente real, backup independiente/retención/acceso y restauración operacional con RPO/RTO medidos; roles/índices/compatibilidad históricos productivos; claves/proxy/rate limit reales; Safari/dispositivos físicos y auditoría independiente aplicable. Backup sintético no prueba operación productiva. Sin merge a feature/main, Render/Empresarial/Blushéa, costos o datos reales modificados.

Siguiente: comprobar CI exacta y cerrar evidencia; después contexto de altas/ciclos dedicados de deuda/crédito y resolución explícita de metas ambiguas por eventos/consentimiento, preservando fuentes. Releer HEAD/PR389/#407/CI, este informe, matriz y continuidad antes de escribir. Tarea activa; GitHub publicado no equivale a Render desplegado/verificado.


### r103 — corrección tras CI del primer SHA

El SHA `ffcdf1a149a4cfb8969099384e037df058b99a17` (árbol `290b36bc16e6be24330e8d82a8050f10b9715fd2`) pasó MongoDB 96/96 en job 135650067978 / run 44549775288. El navegador no pasó: 31 casos, 5 pass, 25 fail y 1 cancelado; una aserción del interceptor lanzó un rechazo no manejado al recibir 422, cerrando el padre y haciendo fallar los casos posteriores. No son 25 regresiones independientes demostradas. El cuerpo HTTP no quedó registrado en ese intento.

La inspección de código identificó que `hoy()` del intérprete devolvía las 17:00 UTC (mediodía Bogotá); antes de esa hora una captura normal quedaba futura y la aprobación estricta la rechazaba. Los nuevos hechos de hoy usan el instante de captura; ayer conserva su día civil y los vencimientos mantienen su referencia de calendario. No se reescriben borradores históricos ni se relaja la validación de futuros. Nueva prueba cubre medianoche Bogotá, mañana y 23:59:59, ingreso/gasto/préstamos/ahorro/traspaso/cobro/deuda y ayer. El interceptor ahora lleva el error al caso esperado, con diagnóstico sintético, sin cerrar el padre por rechazo no manejado.

Siguiente paso: publicar corrección con lease sobre ese SHA, verificar sus tres workflows y Mongo/navegador; el bloque permanece pendiente de cierre hasta CI verde del SHA exacto. #407 continúa bloqueando integración/despliegue: custodio y respaldo independiente reales, permisos/índices y restauración aislada con evidencia operativa, dispositivos/auditoría pendientes según matriz. Sin despliegue Render.

Validación local de la corrección: 910 casos, 901 pass, 9 omitidos por integración externa, cero fallos. Prueba temporal dirigida 1/1 y sintaxis del navegador correctas. Hallazgo independiente pendiente: los patrones de contraparte de cuentaPorCobrar contienen escapes dobles y una frase como Ana me debe puede quedar REQUIERE_REVISION; no se fuerza identificación ni se considera resuelto en este lote. Revisar con pruebas propias después del cierre.


### r103 — segundo diagnóstico de integración
SHA c0a0ab37936a65173fee4fec97fbe0f037cda2ef / árbol284f49c46cee97654373a1a7b447f307d6bafca5: Gate44551569495 y Seguridad44551569548 success. RunV8144551569575/job135656399120: Mongo96/96. La nueva aprobación llegó a200 y conservó caja900/transacción única/contexto, pero la prueba intentó leer `api` desde page.evaluate aunque pertenece al cierre privado del cliente: ReferenceError. No se publica api para el ensayo: se comprueba el controlador real reabierto desde sessionStorage. El caso de captura siguiente también podía inspeccionar su respuesta antes de terminar el interceptor; se añade espera explícita del interceptor y se propagan sus errores al caso. Conteo de navegador de este intento31/5pass/25fail/1cancel, con cierre del padre tras route.fetch de contexto ya cerrado; no es aceptación del bloque. No se relajan gates/timeouts ni se cambia autenticación. Pendiente CI del siguiente SHA.


## Cierre verificado r103 — 19 de noviembre de 2026 (Colombia)

Un bloque funcional completo: contexto privado del acto de aprobación por lote/elemento, integrado con caja/recibo/borrador/fuentes dentro de la transacción; resumen recuperable por propietario. La captura previa sigue siendo otro acto. Se corrigió además la fecha de los nuevos hechos de hoy para no inventar mediodía futuro. Los intentos fallidos y sus causas están conservados arriba.

Código final `8ebf681ffd3f227470f71f09ff166e88b2d4a5e2`, árbol `c70488d0c827f100267968e00ed9da73101cc696`; padres funcionales `ffcdf1a149a4cfb8969099384e037df058b99a17` y `c0a0ab37936a65173fee4fec97fbe0f037cda2ef`. Publicado con expected_sha/force:false y árbol remoto igual al índice local. PR389 sigue abierto hacia feature/finanzas-personales `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 abierto.

CI del código exacto: [Gate44552554332](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44552554332), [Seguridad44552554242](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44552554242) y [V8144552554318](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44552554318), todos success; ocho jobs V81 aprobados. Job135659879273: Mongo96/96 y Chromium/backend31/31, cero fallos, cancelaciones u omisiones. Local910 casos/901 pass/9 omisiones externas/0 fallos; ci:personal353/349 pass/4 omisiones/0 fallos; pruebas dirigidas solapadas45/45 y contexto4/4, temporal1/1.

Criterios de este bloque verificados en ensayo: dominio distinto de captura/propietario/peer real; rechazo de forja/configuración ausente/ajeno; resumen sin privado; compatibilidad del vector legacy; alteración/contexto ajeno bloquea lectura/replay; carreras contabilizan una vez y fallo después del INSERT revierte todas las escrituras; GET/replay sin clave actual y rotación conservan evidencia; lote/parcial/elemento/interno; HTML/login/API real390 recupera respuesta perdida con1 POST y1 GET, saldo900 y1 transacción sintéticos, sin repetir caja, sin tokens en respuesta y sin desbordamiento horizontal. El controlador real reabierto desde bitácora está bloqueado mientras hay pendiente y libre tras consultar su recibo. No se expone api privado para las pruebas.

BackupV31/44 compatible conV30 y previos; ensayo cifrado en destino aislado vacío con BSON/índices verificados:7910 documentos,7855902 bytes, captura289ms, restauración1188ms y edad1464ms. Son métricas del ensayo, NO RPO/RTO productivos; custodiaIndependiente=false y rpoProduccion=false. No se alteraron datos reales ni se añadieron colecciones/roles/índices en producción.

Los límites anteriores siguen vigentes. No es certificación externa, saldo bancario, prueba de custodia independiente ni aceptación integral del producto. No se fusiona a feature, no se modifica main/Empresarial/Blushéa y no se despliega Render.

Siguiente ejecución: verificar HEAD/base/PR389/#407/CI/instrucciones y este cierre; priorizar contraparte de cuentas por cobrar (escapes dobles observados), revisar fechas civiles sin reescribir originales y exigir pruebas normales/fallos/aislamiento antes de contabilizar; después contextos propios de deuda/crédito y resolución explícita de metas ambiguas. No repetir fechas/compra inteligente ya cerradas. Pendientes externos exactos: custodio independiente real/anclas, respaldo durable con retención/acceso/claves separados y restauración operativa aislada con RPO/RTO, roles/índices/migración/configuración reales, Safari/dispositivos y auditoría independiente según matriz, compatibilidad e informe final. No eludir gates. Automatización existente activa; sin duplicarla ni prometer ejecución ininterrumpida.

Este cierre documental requiere sus propios workflows del SHA publicado; su SHA se obtiene del historial Git/PR, sin autoreferencia circular.
