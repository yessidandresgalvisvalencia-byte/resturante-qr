# GRUK Finanzas Personales — ancla externa de decisiones

## Estado

El módulo `anclaExternaDecision.service.js` permite **crear** y **verificar** comprobantes HMAC-SHA256 de una cabeza de cadena DecisionProof. Su prueba se incluye en `npm run test:finanzas-personales`. **Aún no existe un publicador automático ni almacenamiento externo integrado**, por lo cual esto no habilita por sí solo detección de borrado integral en producción.

## Requisitos de custodia (antes de producción)

1. Generar una clave aleatoria de 32 bytes o más mediante un administrador de secretos/KMS, distinta de las claves JWT, cifrado de datos e idempotencia. No incluirla en GitHub, logs o documentos.
2. Tomar una instantánea consistente de `DecisionProof` y `DecisionChainHeadPersonal`, verificarla y formar el ancla `{usuarioId,secuencia,headHash,emitidaEn,version,algoritmo,firma}`.
3. Publicar cada ancla en almacenamiento externo con política **WORM/retención inmutable** y permisos separados de la cuenta de aplicación. Conservar histórico de anclas: nunca sobrescribir una.
4. Para verificar, obtener de forma independiente la última ancla previamente emitida, llamar a `verificarAncla(ancla, clave, registros, head, usuarioEsperado)` con el identificador del usuario ya autenticado y contrastar contra la cadena completa y la cabeza actual. No extraer `usuarioEsperado` de la propia ancla ni del cuerpo de una petición sin autenticar. Rechazar cualquier retroceso o falta de anclas esperadas.
5. Automatizar alertas de discrepancias, rotación de clave con identificador de versión, recuperación y auditoría independiente antes de afirmar protección contra borrado total.

## Límites

- HMAC prueba autenticidad **solo mientras la clave no sea comprometida**; no aporta no repudio.
- Una base comprometida puede reescribir el historial *y* anclas almacenadas en la misma base; por ello la custodia externa es indispensable.
- El verificador actualmente exige cargar toda la cadena del usuario y **no** es apropiado para usuarios con historial ilimitado. La auditoría transaccional tiene un límite de 10 000 elementos y debe evolucionar a verificación por segmentos.
- No se almacena el contenido financiero en el ancla: únicamente identificador, secuencia, hash y fecha. El identificador sigue siendo dato potencialmente vinculable; controlar acceso.
- No publicar anclas antes de completar exitosamente la transacción que agregó la decisión. Deben ser posteriores al commit; almacenar el ancla externamente con reintentos e idempotencia.
