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

## Estado y siguiente paso

Pruebas puras/locales en curso. Mongo autorizado y navegador requieren CI del lote publicado. No cerrar hasta evidencia completa; publicar con lease/igualdad de árbol y verificar CI del descendiente documental. Siguiente: revisar los otros cambios de origen y adopción de clasificación legacy; otros conceptos requieren diseño contable explícito, después contexto de deuda/crédito y metas ambiguas. Recuperar desde este documento y continuidad/HEAD real, no desde temporales.

Validación previa a publicación r105: módulo918 casos/909 pass/9 omitidos externos/0 fallos; ci:personal353/349 pass/4 omitidos/0 fallos; dirigidas corrección/origen10/10 y origen/caché7/7 (solapadas), sintaxis de helper/cliente/browser y diff correctos. Mongo autorizado incorpora un caso completo nuevo; el navegador extiende el flujo existente de cuenta por cobrar, sin aumentar timeout ni número artificial de casos. Pendiente CI del SHA nuevo. Fixture de moneda USD se inserta nativamente solo en base aislada para representar dato legacy no soportado; no es un alta válida del producto.


### r105 — fallo inicial de Gate y preparación del fixture

SHA5b16ca5c8eea5595591339b72d668330a01568ce / árbol0da5892122cb723a53fbdeffc09713f7012fb6c5: Seguridad44570965048 success. Gate44570965045/job135725560929 falló1 de814 casos (810 pass,3 omitidos): `cobro-cuentas-por-cobrar.integration.test.js` no provisionaba la colección/índices de correcciones en su base aislada `gruk_cobros_ci`. El nuevo guard rechazó con503 Índices de corrección no disponibles, antes de cobrar. Se añade init del modelo al fixture junto a los otros modelos que ya preparaba; no se relaja el guard ni se añaden inicializadores automáticos en producción. Mongo autorizado/Chromium del primer SHA siguen pendientes de inspección. No cerrar el bloque hasta CI íntegra del siguiente SHA.
