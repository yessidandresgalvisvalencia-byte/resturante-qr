# Recibo recuperable de revisión de trabajo — r108

19 de noviembre de 2026 (Colombia). Padre real36967bdfbfe79eb776569b3059a647f8df7a1374/árbol4bfa30b89474527b1ff914e6c1ff267d0d548bde. PR389 abierto/no integrado, integración personal hacia feature652126a03f19fbec3c529cad1e84bff11cd3699e; issue407 abierto. Padre Gate44598902512/Seguridad44598902486/V8144598902419 success, ocho jobs/Mongo99/99/Chromium32/32 sin omisiones. No AGENTS.md adicional hallado; se mantienen instrucciones personales y gates. Fechas/compra y selección r107 ya cerradas, no se repiten como bloques.

## Plan y contrato

Un bloque: recibo global append-only de revisión con recuperación propia y cierre de incertidumbre del cliente. Incluye API, persistencia/transacción, permisos/índice/backup, control de mutaciones y navegador. No es certificación externa ni terminación de V81.

- POST /reconciliar-ingresos-trabajo requiere cuerpo exacto confirmacion:true/versionSeleccion64hex e Idempotency-Key estable de8–100 caracteres seguros. Internamente solicitudId forma parte del contrato. Misma clave/versión devuelve recibo anterior y resultado histórico sin aplicar otra revisión. Misma clave con otra versión409 sin efectos. Carreras con INSERT único reconsultan recibo en transacción nueva, hasta tres intentos; no confirman resultados de un intento abortado.
- Colección nueva fin_recibos_revision_trabajo_personales_v1: índice único(usuarioId,solicitudId), guardas Mongoose y política Mongo efectiva de aplicación find/insert/listIndexes, sin update/delete/DDL. Requiere provisión administrativa fuera del HTTP y credencial separada; no se provisiona producción ni se otorga privilegio automáticamente. Material privado de selección cruda, fuentes y contexto oculto por defecto; API solo devuelve resumen propio.
- Recibo guarda versión solicitada/observada, snapshot canónico de selección, hashes de fuentes originales, referencias exactas de compensaciones delta0, resultado y contexto privado minimizado del servidor. SHA256 cubre esos elementos y solicitud/propietario/fecha. La misma transacción conserva recibo, compensaciones/cursor/outbox; falla tras INSERT de recibo revierte todo. No se reescriben fuentes ni cobros originales.
- Si cambió la selección, crea recibo NO_APLICADA/0 sin cambiar finanzas; POST409 con recibo. No devuelve conteos manuales inventados de la selección anterior:requierenRevisionManual=null. GET /reconciliar-ingresos-trabajo/recibos/:solicitudId verifica dueño, índice, hash, originales y compensaciones/cadena actual y devuelve200 tanto aplicada como no aplicada. Ausente404 no es constancia de que nunca se ejecutó. No certifica estado financiero actual ni saldo bancario; una corrección legítima posterior no invalida el resultado histórico.
- Contexto nuevo FP_REVISION_TRABAJO_CTX_MIN_V1: socket observado con token HMAC por propietario/día y clave separada, familia declarada de navegador/dispositivo sin identidad verificada. No persiste IP/UA crudos ni confía en X-Forwarded-For como identidad. Salida expone compromiso/resumen, no token/contexto privado. Operación interna declara sin red.
- Diario de mutaciones del cliente conserva por propietario la clave/versión/cuerpo antes del envío. Respuesta perdida mantiene bloqueo financiero y solicitud; botón Revisar cobros de trabajo consulta primero el recibo pendiente, también tras recarga. Recibo vinculado cierra la incertidumbre sin POST adicional.404 conserva solicitud y permite reintentar explícitamente el mismo cuerpo/clave; nunca sustituye silenciosamente la selección. Recibo cruzado/otra sesión o almacenamiento no verificable no cierra el pendiente. Cancelar preview no envía POST. No crea pagos ni cambia caja.
- Respaldo cifrado pasa a V32/45 colecciones, añade recibos e índices. V1–V31 conservan su alcance original (V22–31:44), sin inventar colección faltante; lectores viejos no deben tratar V32 como V31. Ensayo de restauración debe usar destino aislado vacío; nunca sobrescribir producción ni borrar fuentes para reparar.

## Aceptación y evidencia requerida

| Criterio | Validación |
| --- | --- |
| Integridad | Hash cubre selección/contexto/resultado/solicitud; originales/compensaciones verificables y recibo histórico tras otra clasificación legítima |
| Atomicidad | Fallo después INSERT recibo revierte caja/proyección/cursor/eventos/outbox/recibo |
| Reintentos | Carrera/misma clave, resultado/hash estables, clave con versión distinta rechazada, NO_APLICADA repetible sin finanzas |
| Aislamiento | JWT ajeno404, fuentes/contexto ocultos, sesión/propietario separados, forja/reproducción cruzada no resuelve diario |
| Protección | Rol real niega UPDATE/DELETE/replace/drop/createIndex en colección; índices requeridos, sin provisión automática HTTP |
| Recuperación | Navegador390 pierde respuesta después commit, recarga, consulta recibo propio, cierra bloqueo y conserva un solo POST |
| Datos | Backup V32/45 cifrado restaura BSON/índices en destino aislado; V31/44 y anteriores siguen legibles |
| Trazabilidad | Árbol API/local igual, expected_sha/force:false, CI del SHA exacto, resultados/límites/siguiente paso versionados |

## Límites y siguiente paso

El recibo acredita una operación histórica propia dentro de su alcance, no trabajo real ni saldo de banco. Hash y rol de aplicación no impiden reescritura integral por administrador; faltan custodia independiente/anclas y operación real. Selección hasta500 cuentas,5000 fuentes, recibo1MiB: exceso falla sin escritura parcial. El diario de revisión está en sessionStorage por propietario; perder ese almacenamiento o la clave requiere recuperación adicional del índice de recibos. No se implementa exportación/importación portable de este diario ni listado paginado de recibos en este bloque. Pendiente reforzar esa accesibilidad conservando originales e incertidumbres; no borrar ni reemplazar entradas antiguas automáticamente.

Siguiente: historial paginado/consulta accesible y exportación/importación propia de pendientes de revisión, con validación y rechazo de mezclas sin reescribir originales; diagnóstico/adopción de origen legacy/proyecciones contradictorias/otros conceptos; contexto de deuda/crédito y metas ambiguas. No repetir bloques cerrados.

#407 sigue abierto: custodio independiente real/anclas, respaldo durable/retención/accesos/claves separados y restauración operativa aislada/RPO-RTO, permisos/índices/migración/configuración reales, Safari/dispositivos y auditoría independiente según matriz, compatibilidad e informe final. No merge, Render, main/Empresarial/Blushéa, servicios/costos nuevos ni datos reales alterados. Tarea activa.

## Validación en curso

Local inicial:módulo922 casos/913pass/9 omisiones externas/0fallos, ci:personal353/349pass/4omisiones/0fallos, dirigidas backup/privilegios/cache49/49. Se añadieron referencias a compensaciones exactas y se repite módulo antes de publicar. Mongo autorizado/browser nuevos y CI del SHA nuevo pendientes; no declarar cierre hasta completar. El SHA del cierre se verifica por Git/PR para evitar autoreferencia circular.


### r108 — primer CI y preservación exacta del snapshot BSON

SHA7f89e134bddf86d6da4ffae04e497e8ad118b4c5/árbol2d6e1cd90d4733fadaa178c36c7c4f42b0304f6d: Gate44602490809 y Seguridad44602490821 success; integración Mongo general y siete jobs V81 aprobados. V8144602490798/job135837311216 falló en el caso nuevo: GET del recibo creado devolvía409 en vez de200 (Mongo100 casos/98pass/2fail, uno es el padre,0omisiones). Se mantiene el rechazo de integridad.

Causa reproducida localmente con toBSON(): Mongoose minimize:true retiraba objetos vacíos anidados del snapshot Mixed al persistir. El hash previo y el posterior diferían. Se fija minimize:false en el nuevo modelo de recibo, conservando exactamente esos objetos; se añade regresión BSON que verifica snapshot/hash/recibo tras serialización. No se normaliza ni reescribe ningún historial existente, no se debilita la comparación de hash y no hubo datos productivos. La colección se introdujo solo en esta rama no desplegada. Nueva CI pendiente; no cerrar todavía.


### r108 — segundo CI: restauración exacta del fixture de adulteración

Código de preservación BSON b513ef5a7e401e05f7c1c6aa8770703d3e2270c1/árbol470aae5fc1bed5608c41233b380efc9aaece10c4: la consulta inicial, reintento, contexto, aislamiento y NO_APLICADA del caso nuevo ya pasaron. V8144603172323/job135839732857 terminó100 casos/98pass/2fail,0omisiones: falló solo la última consulta después de reponer el fixture adulterado. El ensayo capturaba el original con findOne().lean() de Mongoose, que excluye campos privados select:false (por ejemplo keyVersion/metadatosCifrados); al reponerlo nativamente se perdían esos campos y el hash original seguía siendo distinto. El producto rechazó correctamente esa fuente incompleta.

Se corrige exclusivamente la captura del fixture aislado: leer documento BSON completo por la colección administrativa nativa antes de adulterarlo, reponerlo exactamente y comparar documento/GET después de cada reposición. Lo mismo para evento/recibo del ensayo. No se relaja el hash ni se añade reparación de producción. No restaurar fuentes a partir de vistas públicas/proyecciones: conservar BSON original completo. Nueva CI pendiente; navegador contra backend aún no ejecutado en esos intentos fallidos.
