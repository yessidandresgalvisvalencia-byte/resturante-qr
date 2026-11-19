# Contexto del registro original HTTP — r99

Corte: 19 de noviembre de2026 (Colombia). Base real9c84957c8c6ae74628a979cbb6ec8bf5e9c2197f/árbol086682ef20259e8a3c05ec5ca321eb8b1e18b045, integration/fp-hormiga-clasificacion-credito-v81. PR389 abierto hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e, sin merge. Padre: Gate44457166409, Seguridad44457166448 y V8144457166427 success. #407 es issue abierto. No se presupone avance desde649ccda ni se repite r98.

## Bloque y plan

Un bloque funcional: contexto minimizado de nuevos INGRESO/GASTO que llegan por POST /transacciones o /movimientos, ligado a los campos originales y accesible desde su auditoría propia. Conservar originales y efectos financieros; no inventar contexto de registros anteriores ni de flujos todavía no instrumentados.

1. Captura exclusivamente del servidor y diferida dentro de la transacción, después de observar si ya existe la clave externa. Dominio FP_REGISTRO_HTTP_CTX_MIN_V1 y clave dedicada de contexto, separados de compensaciones/metas/cuentas/conciliaciones y secretos de autenticación/datos. Peer del socket, sin confiar en XFF; dispositivo declarado no verificado. CapturadoEn corresponde a la observación al registrar, no a la fecha real del ingreso/gasto.
2. Campos opcionales en la misma fuente insert-only: auditoriaRegistro privado/select:false y auditoriaRegistroHash público. Fuente normalizada por Mongoose antes del cálculo; hash enlaza dueño/ID, huella de campos financieros y compromiso del contexto privado. Guarda fuente/contexto/ancla dentro del mismo INSERT/transacción de cuenta/reserva/Outbox. No cambia dinero ni añade un segundo asiento de caja.
3. Huella de campos: dueño, ID, cuenta/deuda/origen recurrente, tipo, importe, moneda, concepto/categoría/subcategoría, nombre/medio de cuenta, contraparte/descripción, recurrencia/frecuencia, origen declarado, externalIdHash, impactoCaja, estado original y fecha contable ISO. No es hash de todo BSON: excluye createdAt/updatedAt, campos cifrados y otros metadatos no listados. No es una nueva cadena global de originales ni custodia independiente.
4. Excluir privado de JSON/toObject de documentos creados y de consultas normales; la auditoría y confirmación de intento lo solicitan explícitamente y verifican ancla/campos/contexto. Una agregación histórica que usa replaceRoot excluye también el privado. Outbox conserva solo su payload financiero previo. Select:false es defensa de aplicación, no cifrado ni permiso por campo de MongoDB.
5. Contrato idempotente existente: el registro repetido responde409; la confirmación separada verifica la fuente/estado sin recapturar ni necesitar la clave HMAC contextual actual. Con clave externa estable, dos registros simultáneos crean uno. La clave externa sigue siendo necesaria para garantizar ese comportamiento; este bloque no elimina la compatibilidad de /movimientos sin externalId ni afirma que ese uso sea idempotente. Una escritura nueva sin configuración contextual válida falla503, sin confirmar efectos.
6. Verificación pública en la vista de auditoría: comprobar huella y hash del original, mostrar fecha de observación/hash/dispositivo declarado sin token/IP/ID de clave. Registros sin ambos campos se presentan SIN_CONTEXTO_CONSERVADO. Falta de solo uno, fuente alterada, contexto ajeno o formato público usado como evidencia privada fallan409. No se reescribe el historial para completarlo.
7. BackupV28/44, compatible conV27/44 y anteriores; mismas25 colecciones protegidas, sin nuevas colecciones/índices/migraciones. Ensayos Mongo autorizado y Chromium con respuesta perdida/confirmación sin reenviar, auditoría y preservación de fuente/caja; publicar con lease/tree igual y verificar tres CI exactas del código y del cierre.

## Criterios de aceptación

| Criterio | Evidencia requerida |
| --- | --- |
| 1. Origen/privacidad | Dominio/dueño correctos, peer no XFF, cuerpo forjado400, privado ausente de respuesta/consultas/Outbox y serialización, resumen sin IP/token/clave |
| 2. Integridad | Hash liga campos/contexto originales; monto/fecha/cuenta/dueño/ctx alterados409, evidencia parcial y DTO público rechazados; legado explícito sin inventar |
| 3. Atomicidad/caja | Gastos/ingresos cambian cuenta una vez; fallo después de fuente/Outbox revierte cuenta nueva/fuente/evidencia juntos; original intacto tras compensación |
| 4. Reintentos | Carrera201+409, misma clave no duplica; confirmación sin clave contextual actual no escribe ni recaptura; después de corregir devuelve CORREGIDA, no autoriza como activa original |
| 5. Rotación/compatibilidad | Registro nuevo usa nueva clave, original conserva anterior; /transacciones y /movimientos cubiertos, otros flujos sin evidencia no se etiquetan como observados |
| 6. Interfaz/recuperación | Login/HTML/API/Mongo reales, respuesta perdida, un POST y confirmación separada, formulario/solicitud exactos conservados y auditoría visible390 sin exponer privado |
| 7. Trazabilidad/operación | Pruebas normales/fallos, SHA/tree/CI exactos, backup aislado y métricas/limitaciones, matriz/continuidad/siguiente paso versionados |

## Resultados antes de publicar

Local: módulo893casos/884aprobados/9omisiones/0fallos; ci:personal353/349aprobados/4omisiones/0fallos. Dirigidas60/60 y nuevas de contexto/visor16/16. Omisiones locales no sustituyen ensayos autorizados. Sintaxis helper Mongo/harness correcta. Una regresión local esperaba6 etapas en la agregación de conciliación: se actualiza a7 con aserción explícita de exclusión del privado, manteniendo cada filtro y el límite. No se desactivó el gate. Auditoría estática sin patrones revisados de mutación; --enforce conserva salida1 por evidencia externa pendiente #407. CI del SHA publicado, Mongo/Chromium nuevos y cierre todavía pendientes.

## Límites y bloqueo de liberación

Solo captura HTTP de I/G por las dos rutas indicadas. Registros internos/directos, pagos/deudas, captura/IA y otros productores quedan pendientes; SIN_CONTEXTO_CONSERVADO no implica que el registro sea antiguo o que exista prueba de red. El contexto no acredita ingresos bancarios ni identidad/dispositivo/IP real. El hash público prueba consistencia local, no autenticidad independiente. Un administrador que quite coherentemente ambos campos o reescriba fuente/ancla puede simular ausencia de evidencia; sin custodio independiente real no se certifica detección de cualquier reescritura. No confundir checksum, HMAC local y certificación externa.

Los campos existentes se conservan; no hay migración ni reparación de originales, TTL, poda o nuevos borrados. Backup sintético no es copia operacional independiente ni recuperación garantizada. Persisten #407: custodio real/control separado; backup/restore operacional con destino/retención/acceso/credenciales independientes y RPO/RTO medidos; roles/índices/migración históricos productivos; provisión de claves/proxy/rate limit reales; Safari/dispositivos físicos y auditoría independiente cuando corresponda. Sin merge a feature/main, Render, costos nuevos, otros productos o datos reales modificados.

Siguiente: comprobar CI exacta y cerrar este lote; después instrumentar productores restantes y resolver metas ambiguas con eventos/consentimiento preservando originales. Releer HEAD remoto, este informe, matriz, continuidad y CI antes de escribir; no depender del chat ni temporales.
