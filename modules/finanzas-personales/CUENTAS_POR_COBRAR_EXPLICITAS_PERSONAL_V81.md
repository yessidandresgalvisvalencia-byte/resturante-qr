# Cuentas por cobrar explícitas — r104

19 de noviembre de 2026 (Colombia). Base remota verificada `fb135069ae900b5fde264369acc409f4808d72da`, árbol `6040c40238d6708c47b3595deaf6f76cfec500bb`. PR389 abierto, base feature/finanzas-personales `652126a03f19fbec3c529cad1e84bff11cd3699e`. CI del padre: Gate44553444489/Seguridad44553444178/V8144553444277 success; Mongo96/96 y navegador/backend31/31. #407 es issue abierto. Sin AGENTS.md adicional encontrado; se mantienen instrucciones de alcance personal y gates. No repetir compra inteligente ya cerrada en informes de horizonte/obligaciones.

## Bloque y plan

Un bloque funcional: reparar reconocimiento explícito de una cuenta por cobrar, revisar sus datos antes de aprobar y conservar derecho de cobro sin ingreso/caja. Los patrones viejos usaban escapes dobles y no identificaban nombres normales. Se sustituye solo ese intérprete, no todos los clasificadores ni históricos.

- C1 acotada: nombre de una persona antes/después de me debe/me quedó debiendo, un importe con unidad/currency explícita, enteros COP o lucas/palos calculados con BigInt sin truncar fracciones. Escalas con tres decimales/separador potencial de miles (1.001 lucas, 50.000 lucas) se rechazan como ambiguas; no se escoge una interpretación. Nombres genéricos/múltiples, negaciones, cláusulas no comprendidas y fechas parciales permanecen REQUIERE_REVISION; importes inválidos/múltiples/sin unidad422 sin efectos. No se acredita identidad real ni deuda demostrada.
- Fecha de hecho: instante capturado. Cobro esperado: solo civil completa AAAA-MM-DD no anterior al día del hecho, a05:00UTC Bogotá; no inferir día20/mes/año, ni normalizar fechas imposibles. Sin fecha explícita válida se conserva desconocida; no es ingreso futuro confirmado.
- C2 antes de aprobar valida original, nombre/entero/vencimiento; no acepta Por identificar con estado LISTO antiguo. Prestamo POR_COBRAR con origen OTRO (por confirmar), no PRESTAMO supuesto. Cuenta pendiente, recibo y outbox atómicos; no se crean cuenta/caja/transacción por registrar el derecho. Sin reescribir fuentes anteriores.
- Interfaz muestra persona declarada, fecha esperada/desconocida y advertencia; todo texto escapado, recurso versionado. Confirma por contrato existente con versión/clave/propietario y permite GET/replay sin repetir alta.

## Aceptación y evidencia requerida

| Criterio | Ensayo |
| --- | --- |
| Reconocimiento sin inventar | Formas de nombre/acento/compuesto, unidades enteras y escala exacta; genéricos/múltiples/negaciones/desbordamiento/fracciones fallan de forma segura |
| Fechas | Cambio colombiano de día/año, fecha civil completa, desconocida/parcial/imposible/pasada, independencia TZ UTC/Bogotá/Tokyo |
| Integración y recuperación | Copilot real → borrador → aprobación → recibo, rol Mongo restringido, dos solicitudes concurrentes, GET/replay, dueño ajeno, fallo después INSERT revierte todo |
| Preservación y dinero | Texto/captura original intactos, hash del borrador original en recibo; solo una cuenta por cobrar/outbox/recibo, cero cuentas/transacciones nuevas y caja intacta |
| Interfaz | Login/HTML/API reales390, persona/fecha/advertencia visibles antes de aprobar, un POST/consulta sin cambios ni desbordamiento horizontal |
| Trazabilidad | SHA/tree con lease, tres workflows del SHA exacto, ocho jobs, resultados/límites/siguiente paso versionados |

## Límites

C1 cubre gramática acotada: no interpreta toda frase natural, múltiples personas, conceptos de trabajo/origen o promesas relativas. Requiere confirmación humana de lo declarado. El origen OTRO no equivale a préstamo confirmado ni trabajo; los flujos posteriores de cobro conservan su clasificación existente y su revisión por origen debe verificarse aparte, no se acredita aquí el ciclo completo de cobro. La fecha esperada no acredita capacidad del deudor ni autoriza compras. No se reinterpreta ni se corrige automáticamente ningún borrador/préstamo histórico.

No hay esquema/colección/índice nuevo ni migración: backupV31/44 permanece, permisos INSERT-only e índices existentes intactos. No hay escrituras, restauraciones ni despliegues de producción. Custodio independiente real/anclas, backup durable/retención/acceso/claves, recuperación operativa/RPO-RTO, roles/índices/migración/configuración reales y Safari/dispositivos/auditoría/aceptación integral siguen pendientes según #407/matriz. No se eluden gates ni se afirman garantías/certificaciones.

## Preparación previa a CI

Pruebas puras dirigidas y módulos/ci:personal en ejecución; Mongo y Chromium autorizados requieren CI del nuevo SHA. No contar bloque cerrado hasta resultados íntegros. Publicar lote coherente con expected_sha y árbol idéntico, después cierre documental y verificar su CI propia. Siguiente: revisión explícita del origen al cobrar cuentas genéricas sin inventar ingresos/préstamos, después contextos de deuda/crédito y metas ambiguas. Si se interrumpe, recuperar desde este documento/continuidad y HEAD remoto, sin depender de temporales.

Validación previa a publicar r104: módulo916 casos/907 pass/9 omitidos externos/0 fallos; ci:personal353/349 pass/4 omitidos/0 fallos; dirigidas nuevas6/6 y caché personal sin errores (solapadas). Sintaxis helper/browser/cliente y diff correctos. Pruebas de Mongo/Chromium añadidas sin subir timeouts ni saltarlas; pendientes CI del SHA publicado. No son prueba de roles productivos ni aceptación integral.


## Cierre r104 verificado — 19 de noviembre de 2026

Código `6dec49cc58ade3554239a2a007ef5780ab5276f7`; árbol `c5cfe4382875f670d08583de395742d8eccafa2f`. Catorce archivos de Finanzas Personales publicados con expected_sha/force:false sobre `fb135069ae900b5fde264369acc409f4808d72da`, árbol remoto idéntico al índice local. PR389 abierto hacia feature/finanzas-personales `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 continúa abierto.

Un bloque completo: C1 reconoce una persona y un importe explícitos, separa patrimonio de ingreso/caja y deja ambigüedades en revisión; C2 valida el original antes de crear un derecho POR_COBRAR con origen OTRO, recibo y outbox atómicos; la interfaz muestra persona/fecha esperada/advertencia antes de confirmar. Las fechas incompletas no reciben un mes/año supuesto. No se reinterpreta ni modifica ninguna fuente histórica. Criterios de este bloque, no la aceptación integral de producción, verificados en ensayo.

CI del código exacto: [Gate44560726225](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44560726225), [Seguridad44560726187](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44560726187) y [V8144560726203](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44560726203), todos success; ocho jobs V81. Job135688963315: Mongo97/97 y Chromium/backend32/32, cero fallos, omisiones o cancelaciones. Local: módulo916 casos/907 pass/9 omisiones externas/0 fallos; ci:personal353/349 pass/4 omisiones/0 fallos; nuevas dirigidas6/6 y caché/sintaxis/diff correctos. Pruebas solapadas, no sumar como cobertura distinta.

Aceptación evidenciada: nombres explícitos/acentos/compuestos, escala BigInt exacta, importes múltiples/negativos/ambiguos/fraccionarios no exactos/fuera de rango rechazados; nombres genéricos/múltiples/negaciones y texto no comprendido no se aprueban. Fechas completas/imposibles/parciales/pasadas, cambio colombiano de día/año e independencia TZ UTC/Bogotá/Tokyo. Copilot real conserva la declaración y captura originales; concurrencia/replay crean una sola cuenta por cobrar/outbox/recibo, sin cuenta ni transacción nueva. Fallo después del INSERT revierte las escrituras; usuario ajeno404, recibo sin clave actual recuperable; original inválido con LISTO422 sin reparar.

Marcador FP_CUENTA_COBRAR_EXPLICITA: login/HTML/API reales390, persona/fecha/advertencia visibles, un POST, caja1000 intacta, pendiente50000, cero transacciones, GET sin cambios y sin desbordamiento horizontal, datos sintéticos. La clasificación OTRO no acredita origen ni préstamo real; los cobros posteriores requieren la revisión separada indicada en los límites. No se atribuye una fecha esperada a dinero ya recibido ni se autoriza gastar ese pendiente.

BackupV31/44 sin cambio de formato/colecciones: ensayo cifrado restauró7927 documentos/7886338 bytes con BSON/índices en destino aislado vacío; captura325ms, restore1216ms y edad1516ms. custodiaIndependiente=false, rpoProduccion=false. Métricas del ensayo, no RPO/RTO operativos ni recuperación garantizada. No hubo escrituras, migraciones ni restauraciones productivas.

Siguiente: revisar confirmación explícita del origen antes de cobrar cuentas genéricas, sin clasificar automáticamente como préstamo/ingreso ni reescribir originales; después contextos propios de deuda/crédito y metas ambiguas. Recuperar desde este informe, matriz y continuidad; verificar HEAD/base/PR389/#407/instrucciones/CI antes de otro lote. Gates externos pendientes: custodio independiente real/anclas, backup durable con retención/acceso/claves separados y restauración operativa aislada con RPO/RTO, permisos/índices/migración/configuración productivos, Safari/dispositivos y auditoría independiente según matriz, aceptación/compatibilidad/informe final.

Sin merge a feature ni despliegue Render; main/Empresarial/Blushéa intactos. Sin costos/servicios nuevos. Tarea activa, sin duplicar ni desactivar automatización. El descendiente documental debe tener sus propios tres workflows verdes; su SHA y resultados quedan verificables en Git/PR, sin autoreferencia circular.
