# Auditoría propia de movimientos — r98

Corte: 18 de noviembre de2026 (Colombia). Base real b8117c54f93e58e8ae464d656bab0a43053f5536/árbol1fc612d768809c77143a729181f4afd757f99411 en integration/fp-hormiga-clasificacion-credito-v81. PR389 abierto hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e, sin merge. Gate44453879589, Seguridad44453879586 y V8144453879576 del padre success. #407 es issue abierto, mantiene bloqueo de liberación. Estos resultados no aprueban el siguiente SHA.

## Bloque y comportamiento

Un bloque funcional: consulta propia y vista de auditoría compensatoria desde cada movimiento del historial. Hace accesible la evidencia ya conservada en r97; no reemplaza la captura contextual pendiente de registros originales y demás flujos. Prioridad: consultar originales y decisiones sin repetir mutaciones financieras.

GET /transacciones/:id/auditoria requiere JWT/suscripción personales y devuelve no-store también ante401. Identidad de sesión, ID válido y consulta estricta pagina/headHash; no admite elegir dueño. Dentro de una transacción snapshot/primary, lee fuente propia y cadena COMPLETA/cursor mediante el verificador existente (máximo10000 eventos globales), comprueba semántica de compensaciones del movimiento frente a la fuente original y presenta20 eventos por página. No afirma verificar la fuente original de todos los demás movimientos: la verificación global cubre hashes/cursor, y la semántica/fuente es del movimiento elegido.

Página posterior exige headHash de la primera; si cambió cualquier evento de la cadena del dueño, devuelve409 y obliga a empezar de nuevo. No mezcla páginas de snapshots distintos como si fueran una única prueba. Fuente incompatible, delta adulterado, hash roto o cursor inconsistente fallan cerrado. No repara ni omite fuentes, y no interpreta anulaciones heredadas como historial verificable.

DTO incluye fuente original permitida, estado del movimiento en ese snapshot, secuencia/hash global y eventos con resumen/compromiso público. No expone contexto privado, token HMAC, IP cruda, User-Agent ni ID de clave. Lectura no necesita clave HMAC actual. Mantiene dominio y formato de eventos r97, sin reescribir hashes.

La vista Ver auditoría usa solo GET y textContent: original, antes/cambios, tipo/fecha/delta, referencia de restauración, contexto declarado y hash. Comprueba hashes públicos de los eventos mostrados; no tiene la cadena completa ni certifica custodia externa. En préstamos separa capital/pago real/delta. Si falla una página conserva lo ya mostrado y ofrece actualizar desde el inicio; no duplica filas al reconsultar. Respuestas/digests posteriores a cambio de sesión o revisión de búsqueda no repintan la vista. Logout/invalidador existente limpia el contenedor. No persiste ni poda diarios locales. Vista adaptada a390px, pendiente evidencia Chromium propia.

No escribe cuentas, fuentes, eventos, cursor de coordinación ni Outbox. No representa saldo actual, Disponible Hoy ni confirmación bancaria. No crea un protocolo nuevo de recuperación de mutaciones con respuesta perdida; consulta auditoría ya registrada.

## Plan y criterios de aceptación

| Criterio | Verificación requerida |
| --- | --- |
| 1. Lectura autenticada | Dueño de JWT, ajeno/inexistente404, query estricta, no-store/401 y sin campos privados |
| 2. Integridad | Cadena global/cursor verificados, fuente/semántica propias, adulteración de otro movimiento detectada, fuente incompatible rechazada |
| 3. Paginación | Más de20 eventos, secuencias no necesariamente contiguas por movimiento, ancla obligatoria, cadena nueva409, reinicio explícito sin mezclar |
| 4. Conservación | Caja sintética83000 tras gasto corregido15000 y otro2000 desde100000; fotografía idéntica antes/después de GET, originales/eventos/cursor/Outbox intactos |
| 5. Fallos/privacidad | Lectura sin clave, hash falso/contexto privado rechazados, fallo de página conserva vista, sesión/digest tardío no repinta, XSS literal |
| 6. Integración | HTML/API/Mongo autorizado y Chromium390, hashes/antes/delta/contexto visibles, cero escrituras UI, pagina/409/refresco y aislamiento |
| 7. Trazabilidad | SHA/tree/lease, tres CI exactas, métricas de respaldo aislado y actualización de matriz/continuidad/siguiente paso |

## Estado antes de publicar

Nuevos casos puros/handler/UI10/10 y regresión dirigida con versiones frontend14/14 aprobados. Primera suite local: módulo886/877aprobados/9omisiones/0fallos; después se agregó caso de distinción capital/pago real y control de carga de script. ci:personal353/349aprobados/4omisiones/0fallos. Omisiones locales no sustituyen ensayos autorizados. Sintaxis de helper Mongo/harness correcta. Auditoría estática sin patrones revisados de mutación; --enforce conserva salida1 por evidencia externa pendiente #407. Mongo autorizado/Chromium/CI del SHA publicado pendientes.

## Operación y límites

Sin nuevas colecciones, índices o formato: backupV27/44 y política25 colecciones protegidas permanecen. Nuevos datos del ensayo son sintéticos; modificaciones administrativas de fixtures para probar adulteración no son reparación productiva ni permisos de aplicación. El respaldo BSON/índices de CI no prueba semántica de cada fuente ni backup independiente de producción.

#407 permanece abierto: custodio independiente real/control separado; backup/restore operacional con destino/retención/acceso y credenciales separados y RPO/RTO medidos; roles/índices/migración históricos productivos; claves/proxy/rate limit reales; Safari/dispositivos físicos y auditoría independiente cuando corresponda. No desplegar hasta cumplir todos los criterios globales y compatibilidad operativa. Sin merge a feature/main, Render, costos nuevos, otros productos o información real modificada. Sin certificaciones externas ni garantías absolutas.

Siguiente: completar verificación del lote y cierre del SHA exacto; luego contexto de registros originales/demás flujos y resolución explícita de metas ambiguas, mediante eventos y consentimiento conservando fuentes. Releer HEAD remoto, CI, este documento, matriz y continuidad; no depender del chat ni de archivos temporales.
