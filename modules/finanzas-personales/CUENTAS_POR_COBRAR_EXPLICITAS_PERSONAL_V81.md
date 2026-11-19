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

## Validación en curso y siguiente paso

Pruebas puras dirigidas y módulos/ci:personal en ejecución; Mongo y Chromium autorizados requieren CI del nuevo SHA. No contar bloque cerrado hasta resultados íntegros. Publicar lote coherente con expected_sha y árbol idéntico, después cierre documental y verificar su CI propia. Siguiente: revisión explícita del origen al cobrar cuentas genéricas sin inventar ingresos/préstamos, después contextos de deuda/crédito y metas ambiguas. Si se interrumpe, recuperar desde este documento/continuidad y HEAD remoto, sin depender de temporales.

Validación previa a publicar r104: módulo916 casos/907 pass/9 omitidos externos/0 fallos; ci:personal353/349 pass/4 omitidos/0 fallos; dirigidas nuevas6/6 y caché personal sin errores (solapadas). Sintaxis helper/browser/cliente y diff correctos. Pruebas de Mongo/Chromium añadidas sin subir timeouts ni saltarlas; pendientes CI del SHA publicado. No son prueba de roles productivos ni aceptación integral.
