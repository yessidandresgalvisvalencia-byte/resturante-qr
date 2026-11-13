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


## Cierre funcional verificado r93 — 13 de noviembre de 2026

Código/pruebas aaa871df7c3e454af8de483fc210b9813de70122, árbol c5cf7b122e6675820e61e98b880d5101f12ff29d; padre a03fc309b9472482875ab8e54ebe90442fd030ff/árbol ee6ab6bb9843ad4554ea87c7ad304727efcb0a16. Ambas publicaciones con expected_sha/force=false y árboles local/remoto idénticos, exclusivamente integración personal. Base feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e sin integrar.

[Gate43415652150](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43415652150), [Seguridad43415652181](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43415652181) y [V8143415652159](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43415652159) success para ese SHA. Ocho jobs V81 aprobados. [Job131852743320](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43415652159/job/131852743320) confirma checkout exacto, Mongo86/86 y navegador/backend21/21, cero fallos/omisiones/cancelaciones.

El nuevo ensayo autorizado de contexto acredita clave dedicada, rollback503 sin residuos, actor propietario, separación por dueño/día Bogotá/clave, rotación, replay y lectura sin clave actual, aislamiento404, rechazo de cuerpo extra, ausencia de IP/UA/JWT crudos y de tokens en respuesta, contexto interno explícito, legado sin contexto y detección de adulteración. FP_CONTEXTO_META verificó HTML/API/Mongo/Chromium390, peer de socket con XFF falsificado ignorado, dispositivo declarado sin verificar, historial propio sin token/clave y compromiso público recalculable, originales/caja sin cambios. No demuestra IP real ni identidad del dispositivo.

El caso previo de calendario que falló en el primer SHA ahora aprueba: copia ajena rechazada, recuperación propia sin POST, recibo propio, cuota429 conservada, originales/formulario/archivo intactos. Reproducción local en memoria revirtiendo únicamente el guard de consulta:11/12, falló exactamente el rechazo ajeno tapado por Calendario consultado. Con corrección, calendario/copia64/64; módulo853 casos/844aprobadas/9omisiones/0fallos; ci:personal353/349aprobadas/4omisiones. No se amplió timeout ni se omitió el caso. Estas omisiones locales no sustituyen los ensayos autorizados citados.

Respaldo aislado V24:44 colecciones,7236 documentos,7328830bytes; captura284ms, restauración1194ms, edad1478ms, custodiaIndependiente=false y rpoProduccion=false. Son métricas sintéticas BSON/índices, no RPO/RTO operacionales ni backup real de producción. V23/44 y anteriores siguen legibles. Política25 colecciones protegidas ensayada en runner; sin provisión/migración/restauración productivas ni reescritura de originales.

Gasto inteligente se revisó nuevamente: exige saldo/obligaciones y snapshot verificables, horizonte futuro válido con importe exacto, sin evaluación de compra con fecha desconocida o no futura. Se conserva esa implementación. Auditoría estática sin patrones revisados de mutación; --enforce continúa saliendo1 por evidencia externa pendiente #407. No se desactivaron gates.

Un bloque funcional de auditoría de metas, con corrección de regresión descubierta en CI; commits/documentación no se cuentan como bloques adicionales. Criterios1–7 anteriores verificados en el alcance descrito. El descendiente documental necesita sus propias tres CI; su SHA exacto y resultados finales quedan en el pie del PR389 e historial Git. Checkpoint recuperable: leer esta sección, matriz y PR389, verificar HEAD remoto/CI antes de cualquier siguiente escritura con lease.

Siguiente: ampliar contexto minimizado a otros flujos financieros y revisar explícitamente legados ambiguos, sin omitirlos ni repararlos automáticamente. Antes de producción: verificar topología real de proxy/rate limiting, clave dedicada/rotación/acceso y retención legal-operacional, custodio independiente real, backup/restore independiente con credenciales separadas y RPO/RTO, roles/índices/migración históricos productivos, dispositivos físicos/Safari y auditoría independiente cuando corresponda. #407 abierto. Sin merge a feature/main, Render, costos, otros productos ni datos reales modificados. No certificación externa ni garantías absolutas.
