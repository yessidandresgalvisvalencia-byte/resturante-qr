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
