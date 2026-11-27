# Origen confirmado antes de cobrar — r105

19 de noviembre de 2026 (Colombia). Base comprobada `50c806061d730a0152db839fda5aa0048a6548fd`, árbol `94160a5e5faff4266512c1eacbb4a9122e9d460b`. PR389 abierto/base feature/finanzas-personales `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 issue abierto. Padre con Gate44561720520/Seguridad44561720741/V8144561720416 success, Mongo97/97/browser32/32. Sin AGENTS.md adicional hallado; instrucciones personales y gates intactos. Compra inteligente/horizonte ya cerrados en documentos previos: no repetirlos como bloque.

## Plan y alcance

Un bloque funcional: cobros dedicados y conversacionales no tratan OTRO/ausente/desconocido como recuperación de préstamo. Antes de tocar saldo/caja/transacciones consultan el origen persistido en la misma transacción, sin defaults de Mongoose. TRABAJO determina INGRESO; PRESTAMO determina COBRO_PRESTAMO. Otros conceptos requieren revisión, no deben renombrarse para eludir el bloqueo.

Se reutiliza PATCH de corrección con confirmación/clave/propietario y eventos INSERT-only anterior/posterior/chain/cursor/outbox; no se crea otra API o colección. Al hidratar una fuente sin origen se conserva ausente hasta que haya un cambio explícito, en lugar de introducir PRESTAMO por default. Cambia la proyección mutable, conservando fuentes/recibos/eventos anteriores. Se verifican índices e historial existente antes de cobrar; un origen actual distinto al último posterior auditado bloquea sin reparar. Para un origen conocido legado sin eventos solo se conserva la clasificación persistida: no se acredita confirmación humana histórica.

El endpoint dedicado valida saldo/principal originales enteros, origen en filtro de actualización y cuenta COP activa leída sin defaults con saldo seguro no negativo y capacidad BigInt. Replay resuelve antes de evaluar un cobro nuevo, sin recontabilizar ni inventar una clasificación vigente. Carreras de corrección/cobro se coordinan por la escritura de la misma proyección dentro de transacción. No se hacen migraciones ni cambios administrativos en producción.

La interfaz ofrece Confirmar origen y retira Registrar pago recibido mientras el origen es desconocido. Prompt sin préstamo preseleccionado; cancelar u OTRO conserva revisión. Confirmación no crea dinero; el pago posterior es otra acción explícita. Historial muestra cambio de origen. Sin valores reales en pruebas.

## Aceptación

| Criterio | Evidencia requerida |
| --- | --- |
| Clasificación estricta | Ambos flujos rechazan OTRO/ausente y cuerpo que intenta forjar origen; conocidos conservan tipo correcto |
| Confirmación trazable | Consentimiento/clave/JWT, anterior/posterior/hash/cursor, índice e historial válidos, original de aprobación intacto; fallo después INSERT revierte proyección/evento/outbox |
| Dinero y reintentos | Confirmar no toca caja ni transacciones; pagar acredita una vez y reduce pendiente exactamente; carrera/replay y clave con otros datos; rollback de outbox |
| Legacy y aislamiento | Fuente sin origen no recibe default; ajeno rechazado; origen adulterado en proyección no coincide con último evento y bloquea |
| Interfaz | Login/HTML/API/Mongo restringido390: botón de cobro ausente antes, confirmar sin caja, pago separado y replay sin cambios, sin desbordamiento |
| Trazabilidad | HEAD/tree/lease, CI verde del SHA exacto, resultados/omisiones/límites y siguiente paso versionados |

## Límites y liberación

No se declara que los orígenes conocidos legacy provengan de una confirmación auténtica: falta diagnóstico/adopción histórica por evidencia. OTRO puede ser un concepto real distinto de trabajo/préstamo; falta su taxonomía/flujo explícito y no se debe forzar una categoría falsa. No se acredita identidad externa, prestación laboral ni desembolso real. La corrección preexistente puede reclasificar pagos vinculados mediante compensaciones; este lote no certifica todos esos históricos ni todos los caminos alternativos de cambio de origen.

Selectores de origen no prueban custodia externa. Historial de correcciones acotado1000; se falla cerrado al exceder o faltar evidencia/índices. No se arregla automáticamente una discrepancia ni se reescriben transacciones o recibos. La consulta de replay conserva el contrato anterior; no certifica por sí sola saldo/clasificación actuales después de compensaciones.

BackupV31/44 sin nuevos campos/colecciones/índices: reutiliza correcciones protegidas. Pendientes #407: custodio independiente real/anclas, respaldo durable/retención/acceso/claves separados y restauración operativa aislada/RPO-RTO, roles/índices/migración/configuración reales, Safari/dispositivos/auditoría independiente según matriz, compatibilidad e informe final. Sin merge a feature, sin Render/main/Empresarial/Blushéa, sin servicios/costos nuevos.

## Preparación previa a CI

Pruebas puras/locales en curso. Mongo autorizado y navegador requieren CI del lote publicado. No cerrar hasta evidencia completa; publicar con lease/igualdad de árbol y verificar CI del descendiente documental. Siguiente: revisar los otros cambios de origen y adopción de clasificación legacy; otros conceptos requieren diseño contable explícito, después contexto de deuda/crédito y metas ambiguas. Recuperar desde este documento y continuidad/HEAD real, no desde temporales.

Validación previa a publicación r105: módulo918 casos/909 pass/9 omitidos externos/0 fallos; ci:personal353/349 pass/4 omitidos/0 fallos; dirigidas corrección/origen10/10 y origen/caché7/7 (solapadas), sintaxis de helper/cliente/browser y diff correctos. Mongo autorizado incorpora un caso completo nuevo; el navegador extiende el flujo existente de cuenta por cobrar, sin aumentar timeout ni número artificial de casos. Pendiente CI del SHA nuevo. Fixture de moneda USD se inserta nativamente solo en base aislada para representar dato legacy no soportado; no es un alta válida del producto.


### r105 — fallo inicial de Gate y preparación del fixture

SHA5b16ca5c8eea5595591339b72d668330a01568ce / árbol0da5892122cb723a53fbdeffc09713f7012fb6c5: Seguridad44570965048 success. Gate44570965045/job135725560929 falló1 de814 casos (810 pass,3 omitidos): `cobro-cuentas-por-cobrar.integration.test.js` no provisionaba la colección/índices de correcciones en su base aislada `gruk_cobros_ci`. El nuevo guard rechazó con503 Índices de corrección no disponibles, antes de cobrar. Se añade init del modelo al fixture junto a los otros modelos que ya preparaba; no se relaja el guard ni se añaden inicializadores automáticos en producción. Mongo autorizado/Chromium del primer SHA siguen pendientes de inspección. No cerrar el bloque hasta CI íntegra del siguiente SHA.


## Cierre r105 verificado — 19 de noviembre de 2026 (Colombia)

Código `5b16ca5c8eea5595591339b72d668330a01568ce`, preparación del fixture `93271c0c32972f1509aac7b6aa16517710cea8fa`; árbol final de código `5d98e84ac6a6138d8416f1cf378ede9c1e677eec`. Publicados con expected_sha/force:false sobre HEAD comprobado `50c806061d730a0152db839fda5aa0048a6548fd`, árbol igual al índice local; dieciséis archivos personales entre código, pruebas y documentación. PR389 sigue abierto/base feature652126a03f19fbec3c529cad1e84bff11cd3699e; #407 abierto.

Un bloque completo: origen persistido/revisado antes de cobrar en rutas dedicada y conversacional; OTRO/ausente no se convierten en préstamo por default. Confirmación usa corrección auditada existente con anterior/posterior/cadena/cursor, no toca caja y conserva fuentes/recibos originales. El pago posterior es otra acción, clasificada por origen; índice o historial no verificable bloquea. La interfaz permite cancelar sin forzar categoría y retira cobro mientras falta origen. No se declara completado todo el proyecto ni el tratamiento de otros conceptos.

CI del código exacto `93271c0c32972f1509aac7b6aa16517710cea8fa`: [Gate44571480873](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44571480873), [Seguridad44571480885](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44571480885) y [V8144571481145](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44571481145), todos success; ocho jobs V81. Job135727407200: Mongo98/98 y Chromium/backend32/32, sin fallos, omisiones ni cancelaciones. Local: módulo918 casos/909 pass/9 omitidos externos/0 fallos; ci:personal353/349 pass/4 omitidos/0 fallos; dirigidas corrección/origen10/10 y origen/caché7/7 solapadas. Sintaxis/diff correctos.

El primer SHA falló Gate44570965045 por fixture sin índices de corrección (810 pass/1fail/3skip de814); su V8144570965057 sí aprobó Mongo98/98 y browser32/32 (job135725562042). Se corrigió la preparación de la base aislada, conservando el rechazo503 en producto y sin provisión automática de producción ni omisiones/timeouts ampliados. La evidencia de aceptación es el SHA final verde, no el primer intento.

Criterios del bloque verificados: clasificación conocida vs OTRO/ausente/forja por cuerpo; JWT/consentimiento/clave; anterior/posterior exactos y original ausente conservado hasta cambio explícito; una corrección ante carrera/replay; fallo después INSERT revierte proyección/evento/outbox; confirmación sin caja/transacciones; pago directo concurrente/replay sin duplicar y clave con otros datos rechazada; fallo de outbox revierte; saldo/principal/cuenta COP crudos y capacidad exactos; campo legacy ausente confirmado como PRESTAMO y cobro conversacional clasificado como recuperación; carrera confirmar/cobrar se serializa y cobra una vez tras origen válido; proyección de origen adulterada distinta al último evento falla sin reparar. Fuentes/recibos anteriores intactos.

Marcador FP_ORIGEN_COBRO_CONFIRMADO: login/HTML/API/Mongo restringido390, bloqueo visual previo,1 PATCH y1 POST; OTRO→TRABAJO sin caja; luego cobro200 con caja1200, pendiente49800 y1 transacción INGRESO. Replay conserva snapshot, evento de origen y recibo de declaración originales, sin desbordamiento horizontal. Datos sintéticos; no acreditan trabajo real ni saldo bancario. Se extendió el caso de cuenta por cobrar sin añadir casos artificiales ni aumentar120s de timeout.

BackupV31/44 sin cambio de formato/colecciones: ensayo cifrado en destino aislado vacío preservó BSON/índices,7954 documentos/7925434 bytes; captura293ms, restore1226ms, edad1489ms. custodiaIndependiente=false/rpoProduccion=false. Métricas del ensayo, no RPO/RTO operativos ni garantía de recuperar producción; no equivalen a validación semántica de todos los fixtures corruptos usados para probar rechazos.

Límites y siguiente paso: revisar caminos alternativos de reclasificación de origen y diagnóstico/adopción de clasificaciones legacy por evidencia; un origen persistido conocido sin eventos no acredita confirmación histórica. Diseñar taxonomía contable para otros conceptos sin obligar al usuario a llamarlos trabajo/préstamo. Después contexto propio deuda/crédito y resolución explícita de metas ambiguas. Antes del siguiente lote: verificar HEAD/base/PR389/#407/CI/instrucciones y este cierre; no repetir trabajo ya cerrado.

#407 y criterios integrales de producción siguen pendientes: custodio independiente real/anclas, respaldo durable/retención/acceso/claves y restauración operativa aislada/RPO-RTO, roles/índices/migración/configuración reales, Safari/dispositivos/auditoría independiente según matriz y compatibilidad/informe final. Sin merge a feature, sin Render ni main/Empresarial/Blushéa, sin costos/servicios nuevos ni datos reales alterados. Tarea activa. El cierre documental requiere CI de su propio SHA; se verifica en Git/PR sin autoreferencia circular.
