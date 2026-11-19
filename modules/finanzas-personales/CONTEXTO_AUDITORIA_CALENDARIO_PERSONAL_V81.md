# Auditoría minimizada de calendario — r101

19 de noviembre de2026 (Colombia). HEAD remoto comprobado1f66eedffa87e63d51f6902073c251dcc3f108a0, árbol494a0cd0b4d01519f893240fc9693c06de617f95; PR389 abierto hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. Gate44491002142/Seguridad44491002420/V8144491002194 success; #407 abierto. No se presupone649ccda ni se repite revisión de compra/ingreso ya documentada en HORIZONTE_INGRESO_V81.md y EVALUACION_OBLIGACIONES_VERIFICADA_V81.md.

## Bloque y plan

Un bloque funcional: minimizar la nueva auditoría de eventos de calendario y retirar datos privados de su historial HTTP sin modificar originales, hashes ni efectos financieros existentes. La auditoría del ingreso de recepción r100 se mantiene separada con su dominio propio.

1. Dominio FP_CALENDARIO_CTX_MIN_V1, clave dedicada de contexto separada de autenticación/datos, token HMAC por dueño/día/dominio/peer del socket (ignora XFF). User-Agent se reduce a familia/navegador declarados no verificados. El handler difiere captura hasta después de validar estado/replay; no acepta contexto del cuerpo. HTTP nuevo sin configuración válida falla503 sin efectos. Llamadas internas capturan INTERNO_SIN_RED sin inventar conexión, aunque reciban antiguas opciones ip/agente.
2. Campo opcional privado/select:false auditoriaContexto en el evento INSERT-only, excluido de serialización normal. Los eventos nuevos dejan auditoria.ip/agente vacíos; el actor continúa vinculado al dueño. El hash agrega compromiso del contexto solo si existe; ausencia histórica mantiene el algoritmo anterior. Un vector calculado antes del cambio prueba compatibilidad byte a byte. Contexto alterado/ausente, de otro dueño/dominio o DTO público en lugar del privado bloquean la lectura/cambio.
3. La lectura transaccional solicita explícitamente el privado y verifica la cadena completa antes de listar, obtener recibo o anexar. Replay y GET no necesitan la clave contextual actual ni recapturan. Captura, evento, recepción/ingreso/caja/outbox aplicables conservan la misma transacción, idempotencia y reglas anteriores. Los rechazos de recepción persistidos también conservan su contexto; no crean caja.
4. Historial público por whitelist: excluye contexto, IP/agente antiguos y BSON de la copia original adoptada. Los originales y la copia permanecen íntegros en MongoDB y respaldo, sin repararlos ni borrar evidencia. Se conservan hashes, actor, solicitud y estados; resumen distingue HTTP, interno y LEGADO_SIN_CONTEXTO. Recibos incorporan resumen seguro cuando fueron aplicados. La vista declara comprobación del servidor, hashRecalculableConDTO=false y certificaCustodiaIndependiente=false: no pretende que un DTO redactado revalide localmente el hash completo.
5. Interfaz muestra acción/secuencia/motivo/fecha/contexto/hash como texto, sin imprimir JSON privado ni interpretar HTML. Rechaza formato ajeno, contexto privado, IP/BSON o resumen con campos extra, y elimina vista ante error. Caché personal20261119-contexto-calendario-v81; contrato HTTP/vista se publica junto. No acredita cliente real, ingreso bancario ni identidad de dispositivo.
6. RespaldoV29/44 compatible V28 y anteriores, mismas25 colecciones protegidas e índices. No migración, nuevas colecciones, TTL, limpieza, backfill o cambios productivos. Publicar con HEAD esperado y árbol idéntico, verificar tres CI exactas y guardar cierre/métricas/siguiente paso.

## Criterios de aceptación

| Criterio | Evidencia requerida |
| --- | --- |
| Privacidad/origen | HTTP exclusivamente del servidor, peer no XFF y dominio distinto del ingreso; configuración ausente/forja/ajeno rechazados; serialización/consultas/API sin privado, tokens, IDs de clave ni IP/agente/BSON históricos |
| Originales/compatibilidad | Vector hash legado idéntico, cadena mixta válida y BSON previo intacto; no se recalcula ni sustituye fuente histórica |
| Integridad/atomicidad | Contexto adulterado o incompleto bloquea lectura/replay sin reparar; fallo después del INSERT revierte; carrera misma solicitud crea un evento, sin efectos financieros duplicados |
| Reintentos/rotación | GET/replay sin clave actual conservan snapshot; nueva operación usa nueva clave y eventos anteriores intactos; interno sin red y decisión no aplicada explícitos |
| Interfaz/recuperación | Login/HTML/API/Mongo autorizado, acuse perdido tras commit, un POST y consulta GET, solicitud exacta conservada, historial claro/redactado390 y ajeno404 |
| Trazabilidad/operación | Pruebas normales/fallos, SHA/tree/CI y respaldo aislado documentados; checkpoint/matriz/continuidad publicados; límites y bloqueos no se desactivan |

## Resultados previos a publicar

Local: módulo900 casos/891 aprobados/9 omisiones/0 fallos; ci:personal353/349 aprobados/4 omisiones/0 fallos. Dirigidas calendario/handler/respaldo44/44 y contexto/interfaz/versionado62/62 (se solapan; no sumar como casos distintos). Un fixture puro usaba ID arbitrario para CREAR; se corrigió para derivar idCreacion, manteniendo el vector previo con ID fijo separado. No se debilitaron validaciones. Mongo autorizado y Chromium nuevos pendientes de CI del SHA publicado; omisiones locales no sustituyen esos ensayos. No se amplían timeouts ni se omiten gates.

## Límites, bloqueo y siguiente paso

Select:false/transform/DTO no son cifrado ni permiso de Mongo por campo. La IP/agente antiguos permanecen en evidencia del servidor y respaldo; este cambio no promete su borrado físico. La lista de calendarios legados conserva el contrato anterior y datos financieros originales, no se presenta como auditoría minimizada de todos los modelos o metadatos posibles. Otras familias de eventos/captura/aprobación IA/deuda/crédito siguen pendientes de contexto en su alcance. Un administrador capaz de reescritura coherente de contexto/cadena sigue fuera de la prueba local; falta custodio independiente real.

#407 y liberación integral siguen bloqueados por evidencia operacional real: custodia independiente, backups separados/retención/acceso y restauración operacional aislada con RPO/RTO medidos; permisos/índices/compatibilidad históricos productivos; provisión de claves/proxy/rate limit reales; Safari/dispositivos físicos y auditoría independiente aplicable. Backup sintético no garantiza recuperación ni certifica operación productiva. Sin merge, Render, main/Empresarial/Blushéa, costos o datos reales modificados.

Siguiente: confirmar CI exacta y cerrar evidencia; después contexto de captura/aprobación IA/deuda/crédito y resolución explícita de metas ambiguas por eventos/consentimiento, preservando fuentes. Releer HEAD/PR389/#407/CI, este documento, matriz y continuidad antes de escribir. Tarea activa; publicado en GitHub no equivale a desplegado/verificado en Render.


## Regresión de contrato detectada por CI r101

Primer SHA571365519e5d90fde2d22fbf68765e9f782095b0/árboldac613bfe3e1f6d4d6cdfc610352b856e68ae8d8: V8144500156330 falló en job135477490630. Mongo94 casos/92 aprobados/2 fallos contando padre; navegador/backend no ejecutado. Stack calendarioAdopcionAutorizada.js:20:109: el ensayo anterior leía fuenteOriginal.length del historial público. Ese BSON ahora se omite deliberadamente, manteniéndolo íntegro en servidor/respaldo. La nueva expectativa exige ausencia pública, fuenteOriginalConservada=true y hashRecalculableConDTO=false; lee el original privado para comprobar BSON, tipos Long/Binary, hash original y copia exacta como antes, y exige que el BSON no aparezca en la respuesta. No se elimina prueba de preservación ni se devuelve información privada para satisfacer la expectativa anterior. Código de producto sin cambios; el SHA corregido necesita CI completa propia.


## Expectativa de actualización del listado en Chromium r101

SHA79a11b050b9cbd7495ec7b8bd1d12472d04c6256/árbol36be7b1b348c63fb515591127a9a35f7376ada2b: Mongo94/94 aprobado en job135478910583; V8144500561478 falló en navegador29casos/27aprobados/2fallos contando padre. Stack backend-recuperacion.browser.cjs:85:1614: locator #ciLista / Ver historial agotó30000ms. Tras confirmar por GET, resolver invalida el listado previo y requiere actualización explícita; el caso ya había comprobado un POST, una consulta, diario confirmado y contexto HTTP. Se ajusta el ensayo para pulsar ciActualizar antes de Ver historial, conservando límites/timeouts y todas las aserciones de caja, privacidad, recibo, solicitud y BSON/hash. No se cambia producto ni se habilita una vista obsoleta. El siguiente SHA necesita CI completa propia.


## Datos financieros conservados en la vista resumida
La revisión de la nueva presentación encontró que acción/motivo/contexto/hash eran insuficientes para revisar cambios financieros. Se muestran también estado, concepto, monto y fecha prevista anteriores/posteriores, y recepción revisada (importe/fecha/cuenta) cuando corresponde. Es información de la misma solicitud/estados ya verificados, no cálculo o ingreso adicional. La prueba del visor exige esos datos además de redacción/aislamiento y texto literal. Se mantienen todos los filtros privados y se requiere CI completa del siguiente SHA; no es un cambio de fuentes, caja o algoritmo de hash.


Validación intermedia r101: SHA7117acfdfa3f7a7245791b21e7b8ee7f572c8bc4/árbol38a5ca165fd4089df89c21075d8424e93790fe3a aprobó Gate44501260140/Seguridad44501260150/V8144501260207; job135481348795 Mongo94/94 y navegador/backend29/29 sin omisiones. FP_CONTEXTO_CALENDARIO confirma login real/Chromium390/un POST/una consulta de recibo, acuse perdido, lectura sin clave, BSON/hash legado intactos y caja sin cambios. La incorporación posterior de importes/fechas al visor requiere CI propia antes del cierre; no se le atribuye anticipadamente esta ejecución. Pruebas locales del ajuste57/57.
