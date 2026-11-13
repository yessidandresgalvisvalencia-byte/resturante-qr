# Contexto de auditoría minimizado de metas — r93

## Plan y alcance

Base real revisada: dc241823c9743a6ae9480ffcdfc03e750c335ac5, árbol c084338306bc49a5988284d846df8b7257942a4f. PR389 abierto hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e; #407 es issue abierto. CI padre: Gate43405953686, Seguridad43405953733 y V8143405953683 success. Un bloque funcional: agregar contexto verificable a nuevas altas/correcciones/retiros/restauraciones/adopciones de metas, preservando fuentes, dinero y reintentos. No abarca otros flujos financieros ni intentos fallidos.

## Criterios de aceptación

1. Actor del JWT, instante del servidor y contexto ligado al hash del recibo/evento; no aceptar contexto enviado por cliente.
2. Conservar solo seudónimo HMAC de conexión por propietario/día Bogotá y categoría de navegador/dispositivo declarada. No persistir IP, User-Agent, cookie o JWT originales.
3. Usar socket observado; ignorar encabezados reenviados como identidad. El peer puede ser proxy: no acredita IP real del usuario. Dispositivo siempre sin verificar.
4. Clave HTTP dedicada obligatoria; falla503 sin fuente, recibo, evento o cursor parcial. Lectura y replay conservan contexto original y funcionan sin clave actual.
5. Contexto interno explícito sin inventar red; históricos sin contexto conservan hash y etiqueta legacy. No reescribir registros anteriores.
6. Historial privado por propietario, sin token/ID de clave; compromiso público permite recalcular hash sin divulgar contexto privado. Rechazar ese DTO como sustituto de documento almacenado.
7. Verificar fallos, rotación, rollback, aislamiento y UI real en Mongo/Chromium autorizados, además de regresiones. CI exacta pendiente al primer envío.

## Implementación e integración

Contexto inmutable opcional en recibo de creación y evento de ciclo. Nuevas entradas siempre lo generan; servicios internos declaran INTERNO_SIN_RED, HTTP usa factory diferida dentro de transacción después del lookup de replay. Una factory síncrona conserva el mismo contexto entre reintentos de transacción. Validación de cadena comprueba forma/propietario y compromiso SHA256 de JSON canónico; la cadena previa sin campo no cambia. Historial público expone auditoriaCompromiso y resumen seguro, no auditoriaContexto. El compromiso no constituye firma ni anclaje independiente y no impide a un administrador reescribir toda la historia.

PERSONAL_AUDIT_CONTEXT_KEY exige32 bytes base64 canónicos e ID PERSONAL_AUDIT_CONTEXT_KEY_ID de1–40 caracteres alfanuméricos/guion/underscore. Se rechaza material uniforme y reutilización detectable de secretos de autenticación/datos. Esto no demuestra entropía, generación segura, separación efectiva de operadores ni custodia. No hay fallback a JWT/PII. Rotación cambia nuevas capturas; lectura de anteriores no necesita clave HMAC. Correlación/reconstrucción y custodia de claves antiguas no están verificadas operacionalmente. No se cambia configuración real ni se despliega una versión que exigiría esta variable sin prepararla.

IP IPv4/IPv6 normalizada, incluidos IPv4-mapped; HMAC liga dueño, día civil Bogotá y peer. Es seudonimización, no anonimización: un custodio de clave puede probar candidatos. User-Agent acotado y reducido a enums no verificadas. UI dice conexión observada/posible proxy y dispositivo declarado sin verificar. No se añade endpoint global de administración.

Respaldo V24/44 acepta V23/44 y anteriores; conserva BSON/contexto/hash sin crear colecciones ni cambiar las25 protegidas. No se autoriza rollback a una versión que no conozca estos hashes. No hay TTL, poda, borrado, retención automática ni destrucción de claves. El contexto acompaña historial inmutable: retención legal/operacional, acceso, destino independiente y recuperación siguen pendientes de evidencia real.

## Evidencia previa a CI y límites

Local: módulo851 casos,842 aprobados/9 omitidos/0 fallos; dirigidas de compromiso18/18; sintaxis helper Mongo y browser correcta. Auditoría estática sin patrones revisados de mutación, pero mantiene bloqueo #407. Omisiones locales no prueban Mongo/Chromium; esos resultados se incorporarán tras CI del SHA publicado. Fixtures reales autorizadas comprueban rollback sin clave, replay/lectura sin clave, rotación, propietario404, XFF falsificado, ausencia de datos crudos, hash público, adulteración y UI390. Ensayos son sintéticos y aislados; no alteran producción.

Pendiente global: extender contexto a demás flujos, revisar trust proxy/rate limiting con topología real (no resuelto aquí), legados ambiguos, custodia independiente, backup operacional/retención/acceso/RPO-RTO, roles/índices/migración productivos, Safari/dispositivos físicos y auditoría independiente cuando corresponda. No se declara seguridad absoluta, recuperación garantizada ni escala productiva.

## Checkpoint

Publicar con expected_sha/force=false sobre la rama de integración; comparar árboles. Ejecutar Gate/Seguridad/V81 del SHA exacto, corregir fallos sin relajar gates y registrar resultados. Luego actualizar matriz/continuidad y volver a verificar CI del descendiente documental. Sin merge a feature/main ni Render mientras los gates globales sigan abiertos. Siguiente bloque independiente: cobertura contextual de otros flujos y revisión explícita de históricos inválidos.


## Hallazgo CI y corrección r93
Primer envío a03fc309b9472482875ab8e54ebe90442fd030ff/árbol ee6ab6bb9843ad4554ea87c7ad304727efcb0a16. Gate43414810581 y Seguridad43414810892 success; V8143414810691 failure: job131849922646 aprobó Mongo86/86 y nuevo caso FP_CONTEXTO_META, pero el calendario previo agotó waitForFunction al esperar el rechazo de una copia ajena (19/21 contando padre fallido). No se presenta como CI verde ni se relajaron tiempos/gates.

Se identificó una respuesta de listado pendiente capaz de sobrescribir el aviso de recuperación rechazada. Recuperar invalida consultas anteriores de listado/historial/recepciones al iniciar, incluso si el archivo se rechaza; cargar no inicia otra consulta mientras la operación está ocupada. No se borra el diario ni se reenvía nada. Dos regresiones con promesa demorada comprueban rechazo ajeno y recuperación propia, conservación exacta, controles cerrados y ausencia de llamadas adicionales. Calendario/copia64/64 local. Corrección integrada al lote: nuevo SHA requiere las tres CI y ensayo nativo21/21.
