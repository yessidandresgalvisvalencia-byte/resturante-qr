# Contexto minimizado de conciliaciones — r96

## Base, plan y alcance

El18 de noviembre de2026 se verificaron PR389 abierto/no fusionado, HEADbf0bc1a73c785d4bad7f783c2bd0684522023b29/árbol b730070710545e864da630e4468de36ba124db3f y base feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. Gate44439967020, Seguridad44439967067 y V8144439967062 success del padre. #407 es issue abierto. README, matriz, continuidad e instrucciones suministradas revisadas; sin AGENTS.md adicional en checkout.

Un bloque funcional: captura de contexto minimizado en nuevas conciliaciones, compromiso ligado al evento, historial privado seguro y recuperación que no vuelva a aplicar anclas antiguas. Se conserva cálculo/validación de la conciliación existente. No resuelve legados ambiguos, compensaciones ni auditoría de los demás movimientos.

## Criterios de aceptación

1. Actor del JWT y contexto del servidor. Ruta HTTP pasa factory diferida por registrarHttp/patrimonio hasta el servicio; el cuerpo no puede elegir dominio, propietario ni contexto. Nuevo dominio cerrado FP_CONCILIACION_CTX_MIN_V1, distinto de metas y cuentas incluso para mismo propietario/día/peer/clave.
2. Capturar después de buscar replay y validar versión/estado, antes de aplicar saldo/ancla. Clave PERSONAL_AUDIT_CONTEXT_KEY dedicada e ID, sin fallback a autenticación/datos; falta o material inválido impide nueva operación HTTP con503 sin residuos. En replay se conserva contexto original y la lectura funciona sin clave actual.
3. Evento de conciliación conserva solicitud/datos/anterior/posterior/fecha/hash previo y agrega contexto opcional immutable. Compromiso SHA256 canónico liga contexto al hash. Registros sin campo conservan hash anterior; internos no inventan red. El contrato HTTP de una llamada directa del servicio no prueba transporte: sin factory se marca INTERNO_SIN_RED.
4. Persistir únicamente HMAC seudónima de socket por dominio/propietario/día Bogotá y categoría declarada de dispositivo/navegador. No IP/UA/cookie/JWT crudos. Ignorar XFF/req.ip como identidad. Peer puede ser proxy y dispositivo no está verificado. Historial público omite contexto privado/token/ID de clave, expone resumen y compromiso que permite recomputar hash. DTO público no sustituye documento persistido.
5. Acreditar una sola aplicación y ninguna reposición de saldo: conciliación100000→120000, gasto posterior5000→115000, consulta/replay de recibo antiguo mantiene115000. Después de otra conciliación110000, replay de la primera mantiene110000 y su ancla vigente. No crear ingreso/pago por observar conexión ni recontabilizar saldo por consultar recibo.
6. Fallos antes/después de aplicar abortan cuenta/evento/Outbox juntos. Fuente de movimientos y recibos de apertura se conservan. Con sesión externa el dueño de esa transacción debe propagar errores/abortar; el servicio captura antes de sus propias escrituras, sin prometer rollback de operaciones ajenas si el llamador ignora errores.
7. Verificar HTTP/Mongo autorizado, aislamiento404, cuerpo extra400, clave ausente503, rotación, hash público, contexto alterado, legacy/internal y UI390 con respuesta perdida/recibo GET sin reenvío. Mantener regresiones, fechas/versión, límites/índices y CI exacta; no relajar gates ni timeout.

## Integración y respaldo

Mismo núcleo de auditoría, wrapper de dominio y esquema opcional; las políticas de metas y cuentas no cambian. Modelo de conciliación agrega auditoriaContexto; datos/anclas y evento Outbox existente no agregan esos campos privados ni cambian fórmula monetaria. El hash extiende el evento solo cuando existe contexto o compromiso público. Verificación exige propietario/política y detecta contexto retirado/adulterado; no requiere claves HMAC antiguas para comparar hash.

La HMAC es seudonimización, no anonimización ni firma externa. La cadena local no impide que un administrador reescriba toda la historia. No se verifican generación/custodia independiente de clave, topología proxy, IP real, identidad física de dispositivo ni integración bancaria. Una conciliación HTTP sigue siendo declaración USUARIO, no saldo bancario certificado.

Respaldo V26/44 acepta V25/44 y anteriores; no se autoriza rollback a código que desconozca estos hashes. Mismas25 colecciones protegidas/44 respaldadas, sin nuevas colecciones, migración, provisión, TTL, poda, retención automática o borrado. Retención legal/operacional, credenciales separadas, custodia real y RPO/RTO operacionales requieren evidencia independiente; no se acreditan con el ensayo sintético.

## Validación inicial y checkpoint

Regresión dirigida44/44 antes de agregar nuevos casos; siete pruebas nuevas de contexto/UI aprobadas. Suites completas locales y fixtures HTTP/Mongo89esperadas y Chromium/backend24esperadas se verificarán antes del cierre; números esperados no equivalen a resultados. La prueba browser introduce gasto real de ensayo después del commit y antes de perder respuesta, conservando solo un POST de conciliación desde UI. Se comprueba luego GET sin clave, replay HTTP separado sin reposición y fuente única de gasto. No modifica datos reales.

Revisado gastoInteligentePersonal.service.js: conserva necesidad de saldo/obligaciones conciliadas, snapshot y horizonte de ingreso futuro con importe exacto; sin datos devuelve FALTAN_DATOS. No repetir implementación. Gate estático --enforce permanece bloqueado por evidencia externa #407.

Publicar lote únicamente en integración personal con expected_sha/force=false y árboles local/remoto iguales; verificar tres CI del SHA exacto y anexar resultados, fallos y límites. Luego cierre documental y CI propia. Siguiente: contexto de movimientos/compensaciones restantes y resolución explícita de metas ambiguas preservando cada BSON, sin reparación u omisión automática.

## Bloqueos de liberación

#407/custodio independiente real, backup/restore operacional con retención/acceso/credenciales separadas, roles/índices/migración históricos productivos, claves/proxy/rate limit reales, Safari/dispositivos físicos y auditoría independiente cuando corresponda siguen pendientes. Sin merge a feature/main ni despliegue Render, costos nuevos, otros productos o datos reales modificados. No certificaciones externas, recuperación garantizada ni seguridad absoluta.


## Fallo de ensayo y corrección r96
Primer SHA22b20ca41757d81a8f77ca85712bf19b1b784012/árbol4a71d1e6992740eb5b2ade73db99151b649b9a7e: Gate44447898260 y Seguridad44447898299 success; V8144447898246 falló en job135304407179. Mongo89/89 y nuevo caso FP_CONTEXTO_CONCILIACION aprobados (120000, gasto5000, saldo115000 y caja165000 intactos, sin reenvío UI). Navegador24casos/22aprobados/2fallos contando padre. La copia de capturas previa intentó rellenar email después de logout/reload con el formulario todavía oculto: helper entrar esperó botón visible pero no recarga terminada ni su onclick instalado.

Se corrige solo la sincronización del ensayo: esperar domcontentloaded de la recarga en paralelo al clic real de logout, comprobar tokens borrados y binding real de choosePersonal antes de pulsarlo. Mantiene login HTTP real, misma identidad, copia ajena rechazada, original exacto y todos los assertions; no inyecta credenciales/sesión ni evita cuotas, no amplía timeout ni omite caso. El nuevo SHA requiere todas las CI y navegador24/24 propios; no se declara completo con este fallo pendiente.

El ajuste de sincronización se acota al caso COPIA_CAPTURA que falló: se cotejó el bloque exacto y se corrigió una coincidencia textual inicial en otra fixture de imputaciones. Esta última conserva su código anterior. La captura espera visibilidad del selector en el documento nuevo y después su binding; la espera de recarga pertenece a ese mismo bloque. SHA5c870060407561285c4904796e54d13d53660b33 fue intermedio, no se toma como cierre aunque su CI terminara. Se conserva historial de commits y nuevo SHA requiere CI propia.


## Causa compartida en ensayo r96
SHA699c1f9df24e17eb29ec00c9f915b0b361b4f368/árbol20919a4eda0c4a1562a2fee073bf253bdf597990: Gate44448878357/Seguridad44448878218 success; V8144448878213 falló en job135307633577. Mongo89/89, copia de capturas ahora aprobada y nuevo caso de conciliación aprobado. Calendario falló en entrarCopia al llenar email oculto tras logout, la misma carrera de navegación/binding; navegador24/22aprobados/2fallos con padre.

Se centraliza salirEsperandoDocumento para los cierres directos del harness: un clic real, domcontentloaded nuevo, onclick instalado y tokens ausentes. Las rutas que ya esperan navegación completa conservan su espera. No se cambian auth, sesiones, datos, cuotas, timeout, número de pruebas ni gates; login/aislamiento/recuperación originales siguen exigidos. Esto corrige sincronización de fixtures, no se cuenta como otro bloque funcional. Nuevo SHA necesita las tres CI y24/24 reales.


## Cierre funcional verificado r96 — 18 de noviembre de2026

Código/pruebas7c00196c5ad46d87948e0b0de5f5a4f793746fee, árbol94e58812cca0b4a8a506b6071c0f4f765b092d1a; padre699c1f9df24e17eb29ec00c9f915b0b361b4f368/árbol20919a4eda0c4a1562a2fee073bf253bdf597990. Primer envío funcional22b20ca41757d81a8f77ca85712bf19b1b784012/árbol4a71d1e6992740eb5b2ade73db99151b649b9a7e. Refs actualizadas con expected_sha/force=false y árboles iguales; solo integración personal. Base feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e sin integrar. Fallos/correcciones intermedios descritos arriba, no reescritos como verdes.

[Gate44449451512](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44449451512), [Seguridad44449451516](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44449451516) y [V8144449451564](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44449451564) success del SHA exacto. Ocho jobs V81 aprobados. [Job135309529054](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44449451564/job/135309529054): Mongo89/89 y navegador/backend24/24, cero fallos/omisiones/cancelaciones.

Nuevo ensayo HTTP/Mongo autorizado aprobó dominio separado, identidad de sesión, cuerpo extra400, clave ausente503 sin efectos, rotación, hash público sin token/clave/IP cruda y aislamiento404. Cuenta100000 concilia120000; gasto real de ensayo5000 deja115000. Replay sin clave de la conciliación inicial preserva esa cuenta/Outbox/movimiento/eventos exactos, no repone120000. Segunda conciliación110000 conserva el gasto; replay de la primera mantiene110000 y ancla vigente. Fallo forzado al guardar evidencia después de aplicar revierte cuenta/Outbox/evento juntos. Aperturas originales intactas, contexto interno explícito, compatibilidad legacy ensayada y adulteración detectada409. Las modificaciones administrativas de fixtures para representar legado/adulteración son solo ensayos aislados, no operaciones autorizadas sobre producción ni permiso de aplicación para reescribir historial.

FP_CONTEXTO_CONCILIACION acredita Chromium390/HTML/API/Mongo: conciliación120000 aplicada, gasto posterior5000 y respuesta perdida; consulta GET propia sin clave actual, sin reenvío UI. Saldo115000 y caja total165000 (incluye otra cuenta50000) conservados. Replay HTTP separado comprueba idempotencia y no reposición; una conciliación y una fuente de gasto, recibos de apertura exactos, compromiso público recalculable y sin tokens. Un POST de conciliación desde UI y una consulta de recibo. No crea ingreso ni transfiere dinero por conciliar. No verifica el banco ni la identidad del dispositivo; conexión puede ser proxy.

Copias previas de calendario/capturas aprueban con login real y cuota429 conservada; copia ajena rechazada y originales/formulario/recibos intactos, sin POST de copia/aprobación. La espera centralizada valida documento nuevo, onclick y ausencia de token tras clic real de logout; no salta auth ni cambia datos/cuotas/timeouts. Se corrigió la sincronización del harness, no se presenta como función financiera adicional.

Local: módulo871casos/862aprobados/9omisiones/0fallos; regresión dirigida inicial44/44 y nuevos contexto/UI7/7; ci:personal353/349aprobados/4omisiones/0fallos. Omisiones locales no sustituyen ensayos autorizados. Sintaxis browser/helper correcta. Auditoría estática sin patrones revisados de mutación y --enforce continúa saliendo1 por evidencia externa pendiente #407. Gasto inteligente releído: preserva saldo/obligaciones y snapshot verificables, horizonte futuro con importe exacto; sin datos no evalúa compra.

Backup sintético aislado V26/44:7784documentos,7535998bytes, captura183ms, restauración760ms, edad932ms; custodiaIndependiente=false/rpoProduccion=false. V25/44 y anteriores legibles. Métricas BSON/índices del ensayo, no RPO/RTO operacionales ni backup independiente real. Mismas25 colecciones protegidas, ninguna nueva. No migraciones/provisión/restauración productivas, TTL, poda, retención automática ni borrados.

Criterios1–7 verificados en el alcance descrito; un bloque funcional de auditoría/recuperación de conciliación. Commits de corrección/pruebas/docs no son bloques adicionales. Descendiente documental requiere tres CI propias; HEAD y runs finales quedan en pie PR389 e historial Git. Checkpoint siguiente: leer este documento/matriz/continuidad y HEAD/CI remotos antes de una nueva escritura con lease, sin depender del chat o temporales.

Siguiente bloque: contexto de movimientos/compensaciones restantes y resolución explícita de metas ambiguas con eventos/consentimiento y cada BSON original conservado; no reparar ni omitir automáticamente. Bloqueos reales de liberación: #407, custodio independiente real/control separado, backup/restore operacional con retención/acceso/credenciales independientes y RPO/RTO medidos, roles/índices/migración históricos productivos, claves/proxy/rate limit reales, Safari/dispositivos físicos y auditoría independiente cuando corresponda. Sin merge a feature/main ni despliegue Render, costos nuevos, otros productos o datos reales modificados. No certificaciones externas, recuperación garantizada ni seguridad absoluta.
