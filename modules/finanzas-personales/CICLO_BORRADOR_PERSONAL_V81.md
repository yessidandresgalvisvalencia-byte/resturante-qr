# Descarte y restauración recuperable de borradores — r89

## Partida y plan

Revisión del 13 de noviembre de 2026. HEAD real `a8835dcf64e1afd91cdbd3bad00039c45d5e4dc0`, árbol `ba5cfa60593d841339f02275e070ccb132411e19`. PR389 abierto/sin fusión sobre `feature/finanzas-personales` (`652126a03f19fbec3c529cad1e84bff11cd3699e`); rama de trabajo única `integration/fp-hormiga-clasificacion-credito-v81`. CI padre success: Gate43356618046, Seguridad43356618042, V8143356618029. #407 sigue abierto con sus seis requisitos. README, continuidad y matriz revisados; no hay AGENTS.md en el repositorio. Horizonte/próximo ingreso y compras estrictas ya resueltos según evidencia versionada, sin repetirlos.

Un bloque completo: descarte/restauración de borradores sin aprobar, con confirmación explícita, versiones, auditoría append-only, recibos recuperables, aislamiento, idempotencia y transacción frente a aprobación concurrente. El endpoint anterior solo cambiaba estado a DESCARTADO, y la interfaz no confirmaba ni ofrecía restauración. No se crean ni compensan movimientos financieros por este ciclo.

## Contratos y aceptación

| Criterio | Implementación |
| --- | --- |
| Confirmación y motivo | POST /captura/:id/descartar y /restaurar-descarte requieren confirmacion=true, versión SHA256 del documento revisado y motivo literal recortado de 8–240 caracteres. Restauración exige descarteHash del último evento; legado verificable usa null. Clave ciclo_borrador_ estable por petición. Campos extras y dueño en query se rechazan |
| Propietario | Identidad exclusivamente de personalAuth/JWT; todas las búsquedas por usuarioId e id. Recibo ajeno404. Lista descartados privada/no-store, página1–50,20 elementos, fuente literal y versión actual |
| Estado de revisión | Solo PENDIENTE sin ninguna aprobación permite descartar. Solo DESCARTADO sin aprobaciones permite restaurar a PENDIENTE. PARCIAL/APROBADO o elementos aprobados se rechazan. No se reactivan fuentes financieras |
| Originales | Evento guarda original completo, cuerpo exacto, clave, hash de solicitud, fecha, secuencia y hash anterior/actual. Texto, canal, items y datos de fuente no se reescriben por el ciclo; cambia solo la proyección estado/cursor. Los cambios posteriores de aprobación se verifican separados de los datos originales del texto/items |
| Atomicidad | Inserción del evento y CAS de estado/cursor/versionado del borrador en transacción snapshot/majority. La aprobación valida el ciclo dentro de su misma transacción; competir por el documento serializa descarte y aprobación. Fallo de evento o cursor revierte ambos |
| Idempotencia | Índices únicos usuario+borrador+secuencia y usuario+solicitud. Replay conserva recibo, aun tras restaurar o aprobar, si cuerpo/ruta coinciden. Clave con otro cuerpo409; versión vieja o referencia superada rechaza sin segundo efecto. Carrera puede dar conflicto recuperable: consultar recibo antes de repetir con misma clave |
| Integridad | Verifica secuencia, hash, fuente estable, original y versión de cada petición, cursor y estado actual. Detecta adulteración, truncamiento cuando existe cursor y contradicciones. No equivale a custodia independiente ni impide reescritura coherente por administrador |
| Legado | DESCARTADO sin historial de este ciclo puede volver a revisión solo con estado de items explícitamente PENDIENTE y aprobadoEn=null. Se conserva el documento legado completo en el primer evento RESTAURACION; no inventa quién/cuándo lo descartó. Legado ambiguo queda no recuperable por este flujo |
| Fallos del navegador | Control central conserva cuerpo/ruta exactos de este tipo de petición además de id/huella/tipo; compatibilidad con registros anteriores de tres campos. Lectura posterior antes de enviar/cerrar. GET de recibo propio resuelve sin POST;404 no demuestra no aplicación. Reenvío explícito usa mismo cuerpo y clave. Otra decisión se bloquea mientras exista una incierta |
| Interfaz | Confirmación y motivo, consulta paginada de descartados y texto con textContent, restaurar separado de Aprobar, pendientes consultables/reintentables. Cambio de cuenta limpia descartados y borradores visibles; ingreso consulta pendientes del dueño actual. Datos de otra sesión tardíos no repueblan la vista |

La colección `fin_ciclo_borradores_personales_v1` bloquea UPDATE/DELETE por modelo y se agrega a la política Mongo protegida (22 colecciones). El rol de aplicación de ensayo solo puede find/insert/listIndexes allí; Borrador sigue siendo una proyección mutable necesaria para aprobación. La configuración productiva de roles no se presume aplicada. La provisión administrativa añade colecciones/índices sin drop/syncIndexes, y no se ejecutó contra producción.

Lista requiere índice de Borrador usuarioId+estado+_id descendente; escritura exige los dos índices únicos del historial. Falta de índice falla cerrada. Capacidad: hasta100 items,1000 eventos por borrador,1MiB de evidencia por evento; consulta20 por página,50 páginas. Históricos más allá de esa ventana y recuperación física de una proyección eliminada requieren tratamiento separado; no se garantiza recuperación universal. No hay TTL ni poda automática.

## Respaldo compatible

V20 añade el historial de ciclo como colección40. V19 conserva sus39 y V1–V18 sus alcances exactos. Preserva BSON e índices y el cifrado/restore aislado existentes; no ejecuta migraciones ni sobrescribe producción. El ensayo operativo de backup independiente, custodio, acceso, retención y RPO/RTO productivos siguen pendientes. Backup incluye eventos confirmados; una petición aún sin commit solo está en el control local del navegador. Ese control contiene motivo y versión por propietario, no JWT, saldos ni el texto íntegro del borrador. No es backup independiente.

## Pruebas y evidencias

```bash
node --test test/finanzas-personales/cicloBorradorPersonal.test.js test/finanzas-personales/cicloBorradorInterfaz.test.js test/gruk/ledger-personal-db-privileges.test.js test/gruk/respaldo-financiero-personal.test.js test/gruk/frontend-version-aislamiento-personal.test.js test/gruk/hormiga-version-javascript-personal.test.js
node --test test/finanzas-personales/*.test.js
npm run ci:personal
node scripts/gruk-personal-ledger-mutability-audit.js
# Solo en runner de pruebas aislado autorizado, nunca producción:
node --test test/finanzas-personales/privilegiosLedgerMongoV81.integration.test.js
node --test test/finanzas-personales/browser/backend-recuperacion.browser.cjs
```

Diez pruebas nuevas de unidad/UI: contratos estrictos, cadena/legado/aprobación posterior, adulteración/cursor, handler y sanitización, persistencia/reintento/recibo ajeno, almacenamiento ignorado, cancelación, respuesta perdida y recarga,404/reenvío explícito y lista literal/respuesta tardía. Una prueba adicional de backup V20/V19. Dirigidas45/45; módulo813/804/9; ci:personal353/349/4, cero fallos. Omisiones locales no son validación operacional. Node24 local frente Node20 CI; sintaxis de nuevos scripts comprobada. Primera pasada local detectó un test que extrae enter sin declarar el nuevo componente: se guardó acceso por typeof, conservando los casos de sesión/dictado, y volvió a aprobar.

Nuevo helper Mongo autorizado cubre descarte/restore/replay, otro dueño, legado, estado parcial/aprobado, dos carreras por clave/versión, carrera contra aprobación, rollback de evento/cursor, UPDATE/DELETE nativo rechazado, adulteración/truncamiento e índice ausente. Respaldo aislado incluye la nueva colección; no usa datos reales. Objetivo de job82 pruebas, pendiente del SHA publicado.

Nuevo caso de navegador contra backend autorizado: crea borrador sintético, pierde respuesta tras descarte real, conserva cuerpo/clave, recarga y consulta recibo sin repetir. Otro dueño404; lista literal, restauración a revisión con texto/items y foto financiera intactos. Solo una aprobación posterior separada crea una fuente; recibo del ciclo sigue verificable. Objetivo17 pruebas y FP_CICLO_BORRADOR, pendiente CI del SHA exacto; no se afirma ejecución nativa local. Se mantienen timeout, cuotas y gates.

## Próximo paso y límites de liberación

Publicar con árboles idénticos y expected_sha/force=false, revisar tres CI del SHA exacto y corregir fallos sin omitirlos. Tras completar este bloque, siguiente: inventariar metas/ahorro y seleccionar una brecha funcional completa de idempotencia, historial o recuperación demostrable. No declarar una reserva de efectivo por crear una meta.

#407/custodia independiente real/backup operativo-retención-acceso-credenciales separadas-restauración aislada-RPO-RTO/roles e índices productivos/dispositivos-compatibilidad-auditoría siguen pendientes. Sin fusión a feature/main, Render, nuevas contrataciones/costos, otros productos ni información real alterada. No hay certificación externa ni garantía de ausencia de fallos o pérdida imposible.

## Cierre funcional verificado r89

Código `673a75654b4ac0a034979f1876742cd841760a5b`, árbol `557bc146de0de8ddbd7ce645231df54fd6a62cb1`; 26 archivos personales, árboles local/remoto idénticos y publicación expected_sha/force=false. [Gate43375659529](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43375659529), [Seguridad43375659411](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43375659411) y [V8143375659365](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43375659365) success para ese SHA; ocho jobs V81 aprobados. [Job131721445416](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43375659365/job/131721445416): Mongo82/82 y navegador/backend17/17, cero fallos/omisiones/cancelaciones.

El subtest autorizado de ciclo aprobó originales, recibos, clave repetida/cuerpo distinto, propietario, legado, estados no recuperables, carreras de descarte/aprobación, rollback, rechazo nativo UPDATE/DELETE, adulteración/truncamiento e índice ausente. FP_CICLO_BORRADOR confirmó descarte con respuesta perdida y solicitud conservada, recibo propio tras recarga sin repetir, otro dueño404, texto literal/items originales, restauración sin aprobar y foto financiera intacta, dos eventos encadenados; solo aprobación posterior explícita creó una fuente. Historial siguió verificable tras aprobar; ancho390 sin desborde.

Respaldo aislado V20:40 colecciones,5618 documentos,3917586 bytes; captura176ms, restauración1710ms, edad1857ms. custodiaIndependiente=false y rpoProduccion=false. Son métricas de un ensayo sintético del SHA exacto, no RPO/RTO operacionales ni configuración productiva. Compatibilidad V19/39 se mantiene. No se ejecutó provisión administrativa, migración o restauración en producción.

Local: nuevas10/10 y una prueba de compatibilidad de respaldo; dirigidas45/45, módulo813/804/9, ci:personal353/349/4, cero fallos. Las omisiones locales no acreditan servicios externos; el alcance real autorizado está descrito arriba. Tarea existente comprobada habilitada. Un bloque funcional completo; no se cuenta la actualización documental como otro bloque. El descendiente documental requiere tres CI exactas propias, cuyos resultados finales quedan en #389 e historial Git.

Siguiente: inventariar metas/ahorro para implementar una brecha completa de idempotencia, historial o recuperación demostrable. No inferir efectivo reservado ni sumar meta declarada a caja. Se mantiene pendiente auditoría contextual de IP/dispositivo del ciclo (este evento registra dueño/fecha/cuerpo/hash), dispositivos físicos/Safari, permisos/índices de todas las colecciones productivas, compatibilidad histórica, custodia independiente y backup-restauración operativo con retención/acceso/credenciales separadas/RPO-RTO. #407 abierto; sin merge a feature/main, Render, costos, otros productos ni datos reales modificados.
