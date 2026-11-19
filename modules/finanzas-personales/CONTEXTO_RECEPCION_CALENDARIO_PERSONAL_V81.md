# Contexto del ingreso recibido desde calendario — r100

19 de noviembre de2026 (Colombia). Base remota comprobada a298235a724af71ec9d74277e01f785421780f39, árbol d4f8d68005136c9a20d92dc94f95a63534eb272d. PR389 abierto hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. Gate44487397978, Seguridad44487397965 y V8144487397982 success. #407 sigue abierto. No partir de649ccda ni repetir revisión ya cubierta de fechas/compra: HORIZONTE_INGRESO_V81.md y EVALUACION_OBLIGACIONES_VERIFICADA_V81.md.

## Bloque, plan y comportamiento

Un bloque funcional: al confirmar REGISTRAR_RECEPCION por HTTP, conservar contexto minimizado en el INGRESO original, ligado a su huella financiera mediante el contrato r99. El handler crea únicamente un capturador del servidor; calendario lo pasa a registrarNuevo y al registrador común dentro de la sesión externa activa. El replay de calendario se resuelve antes de capturar: consultar/repetir un recibo no requiere la clave contextual actual ni vuelve a acreditar caja. Una recepción nueva sin configuración válida falla503. Los vínculos de ingresos existentes, alta/corrección/retiro de calendarios y llamadas internas no inventan contexto HTTP.

Se reutilizan auditoriaRegistro privado/select:false, ancla pública y dominio FP_REGISTRO_HTTP_CTX_MIN_V1. La observación corresponde a la solicitud de guardar, no al cobro bancario real ni a la fecha declarada del ingreso. Peer del socket, HMAC separado por dueño/día/dominio; XFF no decide el token y dispositivo sigue declarado no verificado. La fuente, caja, outbox y evento de calendario se confirman o revierten en la misma transacción. No se inserta otro ingreso para auditar.

La auditoría original se consulta mediante la vista propia existente de movimientos; el recibo de calendario mantiene su contrato y estado histórico. La proyección compensada que usa calendario valida el original privado antes de calcular. No se reescribe ningún campo de fuentes/eventos anteriores ni hashes previos. El evento de calendario conserva su auditoría anterior de IP/agente: este bloque NO minimiza ni certifica la privacidad de todo el historial de calendario. Solo el contexto nuevo del INGRESO se minimiza y permanece privado; no se copia al evento/outbox/recibo. Revisar la auditoría de calendario por separado preservando hashes y originales.

## Criterios de aceptación

| Criterio | Validación necesaria |
| --- | --- |
| Origen y privacidad | Contexto diferido exclusivamente del servidor, dueño JWT, peer no XFF, campos forjados rechazados; token/ID de clave ausentes de respuestas/evento/outbox/consultas normales |
| Atomicidad y exactitud | Falta de clave y fallo después de insertar evento no dejan ingreso, contexto, saldo ni outbox; carrera misma solicitud acredita una vez |
| Recuperación | Respuesta perdida tras commit, solicitud exacta preservada; GET propio sin clave contextual actual recupera recibo sin POST nuevo ni duplicar caja |
| Integridad y compatibilidad | Rotación conserva fuente anterior; adulteración bloquea calendario/replay sin reparar; otras acciones y fuentes sin contexto mantienen semántica explícita, no se rellenan |
| Interfaz e integración | Login real/HTML/API/Mongo autorizado, formulario de recepción y consulta de auditoría390, literal seguro/sin token, dueño ajeno404 y snapshots intactos |
| Evidencia recuperable | CI del SHA publicado, resultados/límites/métricas, plan/matriz/continuidad y siguiente paso versionados; publicación con HEAD esperado y árbol idéntico |

## Validación previa y límites

Local: 29/29 dirigidas. Módulo895 casos,886 aprobados/9 omisiones/0 fallos; ci:personal353 casos,349 aprobados/4 omisiones/0 fallos. Omisiones locales no sustituyen Mongo autorizado ni Chromium. Se añaden caso autorizado y navegador/backend reales; CI del SHA nuevo pendiente. No se amplían timeouts ni se omiten pruebas o gates.

Mismo esquema/colecciones/índices/roles, respaldoV28/44 ya incluye ambos campos. No hay nueva migración ni reparación. Backup aislado no prueba custodia/retención/recuperación operacional. Persisten #407: custodio independiente real, backups independientes y restauración operacional aislada con RPO/RTO medidos, permisos/índices/compatibilidad históricos productivos, claves/proxy/rate limit reales, Safari/dispositivos físicos y auditoría independiente aplicable. Un administrador con reescritura coherente sigue fuera de la garantía local; no se certifica recuperación absoluta o inmutabilidad externa.

Solo Finanzas Personales en integración; sin merge a feature/main, sin Render, sin Empresarial/Blushéa, costos ni datos reales alterados. Siguiente: verificar CI exacta/cerrar evidencia; después contexto de captura/aprobación IA y deuda/crédito, minimización de auditoría de calendario sin reescribir historial, y resolución explícita de metas ambiguas por eventos/consentimiento.


## Cierre de ensayo r100 — 19 de noviembre de2026

Código a1635bb77dbaa6ae430553f42b8899544de4b0d1, árbol bd8c5a6eae543d4485190ee67b1f7d5c32ca3d3f, publicado sobre a298235a724af71ec9d74277e01f785421780f39 con lease sin forzar historia y árbol local/remoto idéntico. Un bloque completo dentro del alcance descrito; no se atribuye evidencia nueva a productores todavía pendientes.

| Verificación del SHA funcional | Resultado |
| --- | --- |
| [Gate44490294686](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44490294686) | success |
| [Seguridad44490294781](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44490294781) | success |
| [V8144490294674](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44490294674) | success, ocho jobs aprobados |
| [Mongo autorizado/Chromium135443898978](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44490294674/job/135443898978) | Mongo93/93 y navegador/backend28/28, cero fallos, cancelaciones u omisiones |

Criterios de origen/privacidad, atomicidad, recuperación e integridad cubiertos por el caso autorizado nuevo y las regresiones existentes: captura diferida, HMAC del peer127.0.0.1 ignorando XFF falso, rechazo de contexto forjado400/ajeno404/configuración ausente503 sin efectos, fallo inyectado después del INSERT del evento revierte fuente/contexto/saldo/outbox/evento; carrera misma clave acredita450 una vez; GET y replay sin clave contextual actual conservan snapshots; rotación usa ctx_recepcion_b sin cambiar el original anterior; adulteración administrativa en el fixture aislado bloquea calendario y replay409 sin reparar o escribir.

Interfaz integrada: FP_CONTEXTO_RECEPCION observó login real, formulario de recepción en Chromium390, un POST confirmado cuyo acuse se pierde y una consulta GET de recibo, sin reenviar. Diario conserva solicitud exacta; fuente/contexto/calendario permanecen intactos y caja sintética3000. Consulta de auditoría propia muestra hash original sin token ni HTML activo; ajeno404. No representa Safari/dispositivo físico ni evidencia bancaria.

RespaldoV28/44 del mismo job:7879 documentos,7720990 bytes, captura235ms, restauración1089ms, edad1334ms. BSON/índices en destino aislado vacío, custodiaIndependiente=false y rpoProduccion=false. Son métricas de ese ensayo, no RPO/RTO o retención productivos. Se mantiene esquema/roles/índices sin nueva migración. Local29/29 dirigidas, módulo895/886aprobados/9omisiones y ci:personal353/349aprobados/4omisiones; omisiones locales cubiertas solo en los alcances reales de CI, no convertidas en aprobación absoluta.

El cierre documental descendiente requiere sus propias tres CI; el SHA y sus resultados quedan enlazados en el PR y en GitHub sin confundirlos con los del código. PR389 continúa abierto; base feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e sin merge. #407 y toda aceptación operacional externa siguen pendientes según matriz: custodio independiente real, backup/restore operacional y retención/acceso separados, roles/índices/compatibilidad históricos reales, configuración productiva, dispositivos y auditoría independiente aplicable. Sin Render, otros productos, main, costos ni datos reales modificados.

Checkpoint siguiente: verificar HEAD remoto/PR389/#407/CI y releer CONTEXTO_RECEPCION_CALENDARIO_PERSONAL_V81.md, matriz y continuidad antes de actuar. Priorizar minimización de nueva auditoría de calendario conservando hashes previos y su compatibilidad, contexto de captura/aprobación IA/deuda/crédito y resolución explícita de metas ambiguas por eventos/consentimiento. No recapturar contexto de fuentes anteriores ni inventar red de trabajos internos. Tarea activa; publicado en GitHub, no desplegado ni verificado en Render.
