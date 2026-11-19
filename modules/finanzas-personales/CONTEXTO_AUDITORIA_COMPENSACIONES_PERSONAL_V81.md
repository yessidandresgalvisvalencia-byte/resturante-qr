# Contexto minimizado de compensaciones de caja V81 — r97

Corte: 18 de noviembre de2026 (Colombia). Base real PR389 e89ec1a8983bfe91b55a1233578051d5eccc9159, árbol266ae090ca54877e11deacfbb378a2aac83a4d55. Integración integration/fp-hormiga-clasificacion-credito-v81 hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. PR abierto/no fusionado y #407 es issue abierto. Gate44449998374, Seguridad44449998418 y V8144449998375 del padre success; job135311317986 Mongo89/89 y navegador/backend24/24. Esto no aprueba el siguiente SHA.

## Bloque y plan

Un bloque funcional: evidencia contextual minimizada de nuevas CORRECCION/ANULACION/RESTAURACION de INGRESO/GASTO de caja que admite el aplicador existente. Conservar fuentes originales, delta exacto, referencia de anulación, reserva cuando corresponde, cursor y Outbox atómicos. Mantener la semántica y los hashes de todas las versiones financieras1–7; no migrar ni reescribir historia. Después: auditoría contextual de registros originales y demás flujos, y resolución explícita de metas ambiguas sin repararlas automáticamente.

1. Captura servidor del peer del socket y dispositivo declarado, con HMAC por dominio/propietario/día Bogotá y clave dedicada. Ignora XFF/req.ip; no certifica IP del cliente ni dispositivo. Dominio FP_COMPENSACION_CAJA_CTX_MIN_V1 separado de metas/cuentas/conciliaciones.
2. Captura diferida tras verificar cadena, fuente, estado y replay; antes de reservas/evento/cuenta/Outbox. Sin clave actual, escritura HTTP nueva falla503 y revierte la unidad; un replay íntegro no necesita recapturar ni reaplicar. Llamada interna declara INTERNO_SIN_RED.
3. Campo privado auditoriaContexto opcional en el mismo ledger append-only. Hash financiero incluye su compromiso SHA256, conservando el payload legado cuando no hay contexto. La validación semántica vuelve a calcular el delta sin permitir que metadatos alteren el dinero. La cadena y el cursor mantienen su verificación global.
4. Respuesta HTTP expone resumen y compromiso verificable, nunca token, ID de clave, IP ni User-Agent crudos. Contexto público no puede sustituir evidencia privada almacenada: lecturas transaccionales, proyección y auditoría con custodio rechazan esa sustitución. No enviar contexto privado a Outbox. Campos contextuales enviados en el cuerpo se rechazan400; propietario viene de sesión.
5. BackupV27/44 conserva el BSON nuevo y leeV26/44 y anteriores. Mismas25 colecciones protegidas, sin colecciones nuevas, TTL, poda, provisión o migración productiva.
6. Pruebas puras, regresión, Mongo autorizado con rol restringido y Chromium con HTML/API reales; comprobar SHA/tree y lease antes de publicar. Confirmar tres CI exactas del código y del cierre documental.

## Criterios de aceptación

| Criterio | Evidencia exigida |
| --- | --- |
| 1. Privacidad y origen | Dominio/propietario propios; XFF no usado; red/dispositivo no certificados; sin secretos en DTO/Outbox |
| 2. Compatibilidad e integridad | Hash legado exacto, cadena mixta, contexto eliminado/alterado/ajeno rechazado, delta falsificado aun con hash recalculado rechazado |
| 3. Caja y originales | Fuente intacta, gasto10000 desde100000 deja90000; corregir15000 deja85000; gasto posterior2000 deja83000; anular devuelve98000; restaurar vuelve83000 |
| 4. Idempotencia y concurrencia | Dos correcciones con misma clave producen un evento/delta; cuerpo distinto409; replay antiguo tras cambios conserva caja/eventos/Outbox sin clave actual |
| 5. Fallos y autorización | Nueva escritura sin clave503 sin efectos; propietario ajeno404; referencia antigua409; fallo Outbox posterior a evento/cursor/cuenta revierte todos |
| 6. Integración y respaldo | Corrección/anulación/restauración desde UI390 y login real; API/Mongo restringido; respaldo/restauración aisladosV27/44 con métricas y compatibilidadV26 |
| 7. Trazabilidad | SHA, árbol, CI y job exactos; alcance y límites versionados, matriz y siguiente paso actualizados |

## Resultados antes de publicar

Pruebas nuevas iniciales5/5; módulo876/867aprobadas/9omisiones/0fallos y ci:personal353/349aprobadas/4omisiones/0fallos. Se añade caso puro de cadena mixta; resultado final se actualizará después de ejecutarlo. Regresiones iniciales de compensación/restauración76/76. Sintaxis de helper Mongo y harness Chromium correcta. Mongo/Chromium nuevos y CI del SHA publicado pendientes. Omisiones locales no sustituyen los ensayos autorizados. Auditoría estática sin patrones revisados de mutación; --enforce debe conservar bloqueo por falta de evidencia externa real.

## Límites y bloqueo de producción

No amplía captura a deudas/compromisos/reescritura de clasificación, registro original de movimientos ni otros flujos; sus eventos legados siguen verificables. El resumen del recibo no certifica estado actual, banco, identidad del dispositivo, ausencia de administradores ni custodia independiente. No se crea un visor nuevo de auditoría ni un protocolo nuevo de confirmación de respuesta perdida para estas operaciones: se conservan los flujos existentes y la idempotencia del servidor. No se presenta el checksum local como firma externa.

La clave dedicada necesita provisión y control reales; comprobaciones de formato/separación no prueban entropía ni custodia. Pendientes #407: custodio independiente real/control separado, respaldo operacional independiente con retención/acceso/credenciales y RPO/RTO medidos, roles/índices/migración históricos productivos, claves/proxy/rate limit reales, Safari/dispositivos físicos y auditoría independiente cuando corresponda. Backup sintético no es respaldo de producción ni recuperación garantizada. Sin merge a feature/main, Render, costos nuevos, otros productos o datos reales modificados.
