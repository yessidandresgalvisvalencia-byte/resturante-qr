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
