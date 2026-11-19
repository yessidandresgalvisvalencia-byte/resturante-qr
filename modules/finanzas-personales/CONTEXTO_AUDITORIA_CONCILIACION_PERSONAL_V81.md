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
