# Auditoría minimizada de apertura y ciclo de cuentas — r95

## Plan, base y alcance

El13 de noviembre de2026 se verificaron PR389 abierto/no fusionado, HEAD9b8af4bcb248cd9befaa2e6e50d891a44db31819 y árbol e801d43b40b3ddfc1ee63536dc663ce938dc24cb. Base feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e; CI padre Gate43421450234/Seguridad43421450288/V8143421450335 success. #407 es issue abierto. Se revisaron README, matriz, continuidad e instrucciones suministradas; no apareció AGENTS.md local adicional.

Un bloque: contexto de auditoría en nuevas aperturas, retiros y restauraciones de cuentas, conservando anclas, recibos, movimientos y saldo. La resolución de metas ambiguas requiere un flujo propio con eventos y validación de cada original; sigue pendiente y no se infiere del diagnóstico r94. Tampoco se completan aquí conciliaciones, movimientos manuales, compensaciones, deudas u otros flujos de auditoría.

## Criterios de aceptación

1. Identidad del JWT y contexto del servidor; no aceptar contexto del cuerpo. Capturar solo al crear una operación nueva dentro de transacción, antes de escribir cuenta/evento/recibo. Una factory diferida conserva contexto entre reintentos de transacción; no se vuelve a capturar en replay.
2. Clave dedicada PERSONAL_AUDIT_CONTEXT_KEY32bytes base64 canónicos e ID PERSONAL_AUDIT_CONTEXT_KEY_ID, sin fallback a autenticación/datos. Falta o configuración inválida impide nueva escritura HTTP con503, sin cambios parciales; lectura y replay de recibos/eventos válidos funcionan sin clave actual.
3. Contexto ligado al hash mediante compromiso SHA256 canónico; modelos conservan contexto inmutable opcional. Los registros anteriores sin ese campo conservan algoritmo/hash. Llamadas internas declaran INTERNO_SIN_RED sin inventar IP o dispositivo.
4. Reutilizar núcleo validado por dominios cerrados FP_META_CTX_MIN_V1 y FP_CUENTA_CTX_MIN_V1. La HMAC por propietario/día Bogotá/peer incluye dominio; no correlacionar la misma conexión entre metas y cuentas mediante el mismo token. Rechazar contexto de dominio distinto. Preservar contrato/hashes/HMAC históricos de metas.
5. Usar socket observado; no XFF/req.ip como identidad. El peer puede ser proxy, no acredita IP del cliente. Persistir solo seudónimo HMAC y categorías declaradas/no verificadas de dispositivo/navegador, nunca IP/UA/cookie/JWT crudos. El dueño recibe resumen seguro; historial público incluye compromiso que permite recalcular hash sin contexto privado ni clave/token. El DTO público no sustituye un documento persistido.
6. Preservar saldo100000 sintético de otra cuenta, fuente/recibos/anclas, retiro solo en cero, referencia de restauración, necesidad de conciliación posterior y recuperación idempotente sin reenviar tras pérdida de respuesta. No copiar saldo antiguo ni generar ingresos/pagos por auditoría.
7. Verificar casos válidos/fallos, rotación, adulteración, dominio, legacy/internal, aislamiento y rollback con HTTP/Mongo autorizado y Chromium390 contra backend real; CI exacta de cada SHA publicado. No convertir pruebas locales omitidas en evidencias Mongo/browser.

## Implementación y compatibilidad

Núcleo común en security/contextoAuditoriaPersonal.service.js con wrappers por dominio. Metas mantiene su política/shape y hashes previos; cuentas recibe política propia. Recibo de apertura y evento de ciclo agregan auditoriaContexto opcional/immutable; fuente de cuenta y evento Outbox de saldo inicial conservan sus contratos. No se añade contexto a sus payloads ni se declara verificada la cuenta por observar la conexión.

El hash nuevo incluye auditoriaCompromiso calculado del contexto, sin persistir ese campo público. La verificación comprueba contexto/propietario/política y rechaza compromiso persistido como sustituto de evidencia. Historial devuelve resumen/compromiso y conserva capacidad de recomputar hash. Esto no equivale a firma externa ni impide a un administrador reescribir toda una cadena; custodia independiente pendiente.

Refactor común mantiene minimización/validación de clave existentes. La rotación no reescribe registros antiguos; leer/verificar su hash no requiere claves HMAC anteriores. No prueba generación de entropía, custodia, correlación autorizada o separación real de operadores. Reutilización del material entre autenticación/datos se rechaza cuando puede detectarse; provisión real de clave separada y operación permanecen pendientes. Cualquier llamador interno que omita factory HTTP queda marcado interno: no certifica cobertura contextual de todos los endpoints.

Respaldo V25/44 lee V24/44 y anteriores, señalando nuevo contrato de auditoría de cuentas. No se autoriza rollback a código que desconozca los hashes/contextos nuevos. Mismas25 colecciones protegidas y44 respaldadas; sin migraciones, nuevas colecciones, TTL, poda, destrucción de claves o retención automática. Retención legal/operacional, control de acceso, destino/custodio independiente, RPO/RTO y restauración operativa deben acreditarse fuera del ensayo aislado.

## Evidencia inicial y checkpoint

Local: módulo867casos/858aprobados/9omisiones/0fallos; dirigidas de contexto/meta/ciclo/UI/respaldo39/39. Fixture Mongo88esperadas y navegador23esperadas aún pendientes al primer envío; no resultados obtenidos. Se añadieron comprobaciones de respuesta perdida/recibo sin clave, saldo no cero, fuentes originales, apertura/ciclo en HTTP y aislamiento. Archivo browser conserva timeout existente; no se amplían gates para simular preparación.

Revisar CI del SHA publicado, corregir fallos y anexar resultados exactos. Publicar solo en integración personal con expected_sha/force=false y árbol local/remoto igual; verificar nuevamente HEAD antes de cada ref. Después, cierre documental y sus tres CI propias. Siguiente: auditoría contextual de conciliación/movimientos restantes y resolución explícita de metas ambiguas preservando BSON original; no usar diagnóstico para reparar automáticamente.

## Límites de liberación

Gasto inteligente se vuelve a revisar en esta ejecución: exige horizonte de ingreso futuro con importe válido, saldo/obligaciones conciliadas y snapshot verificable; no recomendar compras con datos desconocidos ni repetir implementación completada. Se mantiene gate --enforce por #407. Siguen custodia independiente real, backup/restore operacional con retención/acceso/credenciales separadas, roles/índices/migración históricos productivos, claves/proxy/rate limit reales, Safari/dispositivos físicos y auditoría independiente cuando corresponda. Sin merge a feature/main, despliegue Render, costos nuevos, otros productos o datos reales modificados. No certificación externa, recuperación garantizada ni seguridad absoluta.
