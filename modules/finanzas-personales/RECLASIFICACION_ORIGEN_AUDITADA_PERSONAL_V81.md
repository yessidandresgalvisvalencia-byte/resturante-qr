# Reclasificación de origen por auditoría común — r106

19 de noviembre de 2026 (Colombia). Base real `308601cb00844874e09b0d5c75c5c0c5ae5550e6`, árbol `7b123007f05157b2bd046c9df1239eb61b69003b`. PR389 abierto, integración personal/base feature652126a03f19fbec3c529cad1e84bff11cd3699e; #407 issue abierto. Padre: Gate44572533192/Seguridad44572533252/V8144572533183 success. V81 intento2/job135762947062 repitió solo el job cancelado al preparar Chromium: Mongo98/98, navegador32/32, ocho jobs vigentes aprobados, límites intactos. Sin AGENTS.md adicional hallado; se mantienen las instrucciones personales y gates. Compra inteligente/horizonte ya documentados: no duplicar como nuevo bloque.

## Bloque y plan

Un bloque: cerrar el camino antiguo que cambiaba origen guardando directamente la proyección y reparar la revisión de cobros históricos sin inferencias. Se reutiliza correccionPrestamoPersonal, misma colección protegida/cadena/cursor y transacción. No hay esquemas Mongo/colecciones/índices/migraciones nuevos; backupV31/44 sigue vigente.

- POST /cuentas-por-cobrar/:id/corregir-origen-trabajo exige cuerpo exacto confirmacion:true y clave Idempotency-Key. Cuerpo ajeno/incompleto400 y dueño JWT. Conserva el resultado inmediato reclasificados/ingresoTrabajoMinor/saldoPendienteMinor más correccion con hash/duplicado/vigente. Replay no aplica reclasificaciones y declara ingresoTrabajoMinor:null, sin inventar el total de una ejecución anterior. Historial propio existente permite consultar evidencia. Clientes antiguos deben actualizar consentimiento/clave juntos. El marcador interno revisarCobrosTrabajo:true queda dentro de cambios/huella ya protegidos para distinguir la reparación de cobros del PATCH genérico y evitar replay cruzado de intenciones; no se acepta ese marcador por la ruta HTTP antigua.
- La función interna también requiere solicitud explícita. El aplicador de compensaciones deja de guardar origen por sí solo; la corrección dueña de la transacción guarda proyección/evento/outbox. Cambios en transacciones siguen siendo compensaciones con delta caja cero. Una proyección de origen que contradice la última corrección bloquea también nuevas correcciones, sin blanquearla con cambios de otros campos.
- La revisión en lote exige consentimiento y prueba del último cambio explícito de origen en una cadena verificada; no basta con un campo TRABAJO legacy, un nombre de concepto o un cambio de otra propiedad. Lee original sin defaults, reconcilia pagos y deja dudas como revisión manual. Índice/infraestructura no disponible aborta el lote; no se confirma una reparación parcial ante fallos de persistencia. Se mantiene límite500 cuentas/1000 eventos.
- El botón visible Revisar cobros de trabajo pide confirmación, bloquea la acción en curso, muestra tanto correcciones verificadas como pendientes y descarta respuestas de otra sesión. No crea pagos ni cambia caja. La operación de lote conserva idempotencia por cada compensación sobre fuente/estado vigente; no ofrece un recibo global de selección congelada ni garantiza recuperación automática de incertidumbres del cliente. Esto sigue pendiente de flujo específico, no se presenta como terminado.

## Aceptación y validación requerida

| Criterio | Evidencia |
| --- | --- |
| Unificación | Ruta antigua y PATCH comparten cadena/cursor; desaparece el guardado autónomo de origen |
| Autorización | Confirmación/clave, cuerpo estricto y dueño del JWT, rechazos sin efectos |
| Preservación | Fuentes de cobro originales exactas, pagos/caja intactos al reclasificar, eventos compensatorios delta0 y evidencia anterior/posterior |
| Concurrencia/recuperación | Carrera/replay una corrección; GET historial, recibo hash; fallo después INSERT revierte compensaciones/cursor/proyección/evento/outbox |
| Historia | Legacy TRABAJO sin evento explícito no se repara; tras confirmación auditada sí, una vez; proyección adulterada no se blanquea |
| Integración/UI | Nuevo cobro posterior acepta cadena coherente, rol restringido, HTML/login/API390 y botón de revisión; fuentes y saldos conservados |
| Trazabilidad | SHA/tree con lease, tres workflows y jobs del SHA exacto, evidencias/límites y siguiente paso versionados |

## Límites y siguientes pasos

Los orígenes conocidos legacy sin evidencia todavía pueden conservar su clasificación persistida en cobros normales según r105; no se certifica una confirmación humana histórica. Otros conceptos OTRO requieren diseño contable explícito, sin forzar trabajo/préstamo. La revisión opera sobre snapshot actual acotado, no sobre selección inmutable aprobada previamente; faltan recibo global/cierre de incertidumbre del lote y adopción/reparación explícita de proyecciones históricas contradictorias conservando originales. No se reparan esas contradicciones automáticamente.

No es auditoría externa ni prueba de trabajo real/saldo bancario. #407 y criterios completos de producción pendientes: custodio independiente real/anclas, backup durable/retención/acceso/claves y restauración operativa aislada/RPO-RTO, roles/índices/migración/configuración reales, Safari/dispositivos/auditoría independiente/compatibilidad/informe final. Sin merge/Render/main/Empresarial/Blushéa ni servicios/costos nuevos. Pruebas solo en bases aisladas, sin datos reales.

## Preparación y recuperación

Pruebas locales/puras y CI nuevas pendientes. Recuperar desde este documento y continuidad/HEAD real; no contar cierre hasta CI completa. Siguiente: recibo/selección/versiones de revisión en lote y cierre seguro de incertidumbres; diagnóstico/adopción legacy y otros conceptos, después contexto de deuda/crédito/metas ambiguas. No repetir bloques cerrados ni eludir gates.

Ensayo local inicial: 919 casos/909 pass/9 omitidos/1 fallo en un test que extrae solo renderPrestamo: la sincronización del botón quedó dentro de su segmento aislado y requería el helper DOM $. Se movió esa sincronización antes del renderizador, conservando el ensayo aislado y el comportamiento de la página. Repetir suite tras la corrección, sin debilitar el test.

Validación previa a publicación r106: módulo919 casos/910 pass/9 omisiones externas/0 fallos tras corregir el aislamiento del renderizador; ci:personal353/349 pass/4 omisiones/0 fallos; dirigidas de origen/corrección/caché16/16 (solapadas), sintaxis de helper/browser/rutas/cliente y diff correctos. Se agrega una integración con rol restringido y se extiende el mismo caso Chromium390 sin aumentar el timeout ni contar pasos como casos nuevos. CI del SHA nuevo pendiente; no autoriza producción.


### r106 — primer CI y corrección de revisión sin efectos

SHA3493f10fae4e548498839af66a98a7db8c1ad50b/árbol361c0cd45a5f5fb927021f8ae3717b561c52655b: Gate44593858575 y Seguridad44593858645 success. V8144593858493 falló en dos integraciones: job135806780920 esperaba409 al corromper saldo por encima de principal; la corrección común responde422 por importe original inválido. Se conserva un código exacto por caso (422 para saldo inválido,409 para conflictos de estado/fuentes), sin retirar la verificación de ausencia de efectos.

Job135806781184:99 casos/97pass/2fail, cero omisiones; un fallo es el padre del caso nuevo. Un lote que solo debía dejar pendiente un origen legacy incrementaba revisionCompatibilidad del cursor al adquirir anticipadamente la coordinación de escritura, aunque no generaba compensaciones. Se difiere esa coordinación hasta antes de la primera compensación necesaria, dentro de la misma transacción y con reintento de conflictos; un lote sin reparación conserva también ese cursor. No se ignora el campo ni se debilita la comparación del snapshot. No cambia la captura de coordinación en correcciones explícitas, que sí escriben evento/proyección.

Se precisan los acuses del endpoint: cero reclasificaciones confirma solo el origen auditado, y replay declara recuperación anterior sin cambios nuevos. No se afirma haber aplicado reclasificaciones cuando no hubo ninguna. CI del siguiente SHA pendiente; sin merge ni Render.


## Cierre r106 verificado — 19 de noviembre de 2026 (Colombia)

Código inicial `3493f10fae4e548498839af66a98a7db8c1ad50b`/árbol `361c0cd45a5f5fb927021f8ae3717b561c52655b`; corrección final `b8a222d1525a1ee0810891e39420e0677886f5d3`/árbol `7847a6a856d453b60bbd243995d59684ae49e27f`. Dieciocho archivos personales, publicados con expected_sha/force:false sobre HEAD comprobado308601cb00844874e09b0d5c75c5c0c5ae5550e6 y árbol idéntico al índice local. PR389 abierto/base feature652126a03f19fbec3c529cad1e84bff11cd3699e; #407 abierto.

Un bloque completo: ruta antigua individual unificada con corrección auditada e idempotente; revisión en lote con consentimiento y evidencia explícita de origen; confirmación de historias antiguas sin inferir por concepto/campo; botón revisable con resultados y pendientes claros. No se conserva un guardado autónomo de origen en el aplicador. Se mantiene todo cobro original y la caja; las reclasificaciones son compensaciones delta0. La revisión que no necesita compensar tampoco adelanta el cursor de coordinación. No se declara terminado el proyecto ni el recibo global de lote pendiente.

CI del SHA exacto b8a222d1525a1ee0810891e39420e0677886f5d3: [Gate44594804568](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44594804568), [Seguridad44594804698](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44594804698) y [V8144594804456](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44594804456), todos success; ocho jobs V81. Job135810095214: Mongo99/99 y Chromium/backend32/32, cero fallos, omisiones o cancelaciones. Local919 casos/910 pass/9 omisiones externas/0 fallos; ci:personal353/349 pass/4 omisiones/0 fallos; dirigidas16/16 solapadas. Sintaxis/diff correctos. Los fallos iniciales y sus causas/correcciones se conservaron arriba, sin omitir pruebas ni ampliar límites.

Aceptación evidenciada: consentimiento/clave/cuerpo estricto/JWT y ajeno rechazados; nueva cadena anterior/posterior coherente y GET de historial; una corrección con carrera/replay, sin doble compensación ni caja; huella distingue revisión de cobros del PATCH genérico y rechaza replay cruzado; fallo después INSERT revierte proyección/cadena/cursor/eventos/outbox; cobros originales y cuentas intactos; pago posterior acepta clasificación coherente; TRABAJO legacy sin confirmación explícita se conserva pendiente; después de confirmación auditada, lote repara una vez y segundo lote conserva snapshot/cursor; proyección de origen adulterada no se blanquea con corrección de otros campos.

La integración Mongo general también verificó cobros históricos sin impacto de caja, origen en ambos sentidos, sumas compensadas/reconstrucción de caja, estados/importes/fuentes alterados, carreras, rollback y endpoints/diagnósticos con el nuevo consentimiento. No se retiró la comparación del cursor cuando detectó un cambio técnico no requerido.

Marcador FP_RECLASIFICACION_ORIGEN_AUDITADA: login/HTML/API390, ruta antigua sin consentimiento400; confirmación por auditoría, replay sin cambios, botón visible y1 POST de revisión, caja1200/transacciones1/pendiente49800 intactos, fuentes/primer evento de corrección/recibo de declaración conservados y sin desbordamiento horizontal. El caso se extendió sin aumentar32 casos ni120s del padre. Datos sintéticos, no evidencia de identidad/trabajo ni saldo bancario.

BackupV31/44 sin nuevos esquemas Mongo/colecciones/índices: ensayo cifrado con BSON/índices en destino aislado vacío,7975 documentos/7952642 bytes; captura339ms, restore1179ms y edad1440ms. custodiaIndependiente=false y rpoProduccion=false. Métricas del ensayo, no RPO/RTO de producción, custodia durable o validación semántica de todos los fixtures deliberadamente corruptos. No hubo restauraciones/migraciones/escrituras productivas.

Siguiente bloque: selección/versiones y recibo global de revisión en lote, con recuperación/cierre seguro de incertidumbres; diagnóstico/adopción de orígenes legacy/proyecciones contradictorias y otros conceptos de cobro, después contexto deuda/crédito/metas ambiguas. El lote actual revisa snapshot acotado vigente; no se presenta como selección congelada aprobada ni recuperación completa de solicitud incierta. Antes de modificar: verificar HEAD/base/PR389/#407/CI/instrucciones y este cierre, sin repetir trabajo cerrado.

Gates externos pendientes: custodio independiente real/anclas, backup durable con retención/acceso/claves separados y restauración operativa aislada/RPO-RTO, roles/índices/migración/configuración reales, Safari/dispositivos/auditoría independiente según matriz y compatibilidad/informe final. Sin merge a feature ni Render; main/Empresarial/Blushéa intactos, sin servicios/costos nuevos ni datos reales alterados. Tarea activa. El descendiente documental requiere sus propios workflows del SHA exacto, verificables en Git/PR sin autoreferencia circular.
