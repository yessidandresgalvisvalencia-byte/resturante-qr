# GRUK Finanzas Personales — ancla externa de decisiones

## Estado

El módulo `anclaExternaDecision.service.js` permite **crear** y **verificar** comprobantes HMAC-SHA256 de una cabeza de cadena DecisionProof. Para nuevas emisiones debe utilizarse `crearAnclaVerificada({registros,head,usuarioId,emitidaEn},clave)`, que comprueba la cadena completa, su cabeza y titularidad antes de firmar; `crearAncla` es una primitiva de bajo nivel que no valida el historial. Su prueba se incluye en `npm run test:finanzas-personales`. **Aún no existe un publicador automático ni almacenamiento externo integrado**, por lo cual esto no habilita por sí solo detección de borrado integral en producción.

## Emisión desde MongoDB

La función `emitirAnclaDecisionMongo(usuarioId, clave)` en `services/anclaDecisionMongo.service.js` lee la cabeza y el historial en un snapshot transaccional de MongoDB; comprueba titularidad e integridad antes de firmar. Rechaza cadenas vacías, dañadas y mayores de 10 000 registros. **No hace escrituras ni publica el ancla**. La llamada debe hacerse solo desde un proceso autorizado, con clave custodiada en un administrador de secretos; nunca desde una API pública ni desde el navegador.

Opcionalmente, `emitirAnclaDecisionMongo(usuarioId, clave, {anclaPrevia})` verifica, dentro del mismo snapshot, que la última ancla confiable conservada **fuera** de MongoDB coincida con el prefijo de la cadena y con el propietario. Si hay una firma falsa, retroceso o reescritura de ese prefijo, rechaza la nueva emisión. El argumento `anclaPrevia` **no debe provenir del cliente**: lo debe recuperar un servicio autorizado desde custodia externa independiente. La función no puede comprobar que sea la última ancla realmente publicada si el proveedor externo no garantiza esa consulta. Omitir el argumento mantiene la emisión sin garantía de continuidad, útil solo para inicialización controlada.

Una instantánea coherente evita carreras entre lectura del historial y su encabezado, pero la firma **no demuestra por sí sola** cuándo se tomó la instantánea o si se manipuló la base antes. La publicación externa WORM debe ocurrir tras un commit y protegerse contra sustitución y retroceso de anclas.

## Auditoría independiente desde MongoDB

`verificarAnclaDecisionMongo(usuarioId, clave, anclaExterna)` abre una transacción con lectura snapshot, consulta únicamente el historial del usuario indicado y verifica la ancla externa contra la cadena actual. Devuelve `ANCLA_VERIFICADA` cuando coincide y códigos de error cuando no, sin devolver registros financieros. Rechaza entradas inválidas y no verifica más de 10 000 elementos.

**La aplicación debe obtener `anclaExterna` de un almacén independiente con permisos y retención inmutable**, no del navegador o de la misma base que audita. La función comprueba autenticidad y consistencia, pero no demuestra que el comprobante proporcionado sea el más reciente: esa propiedad depende del almacén externo.

## Auditoría con custodio externo obligatorio

`auditarAnclaCustodiada(usuarioId, clave, custodio)` obtiene la última ancla mediante `custodio.obtenerUltimaAncla(usuarioId)` y la coteja contra MongoDB. Si falta el custodio, falla su lectura o no hay un comprobante, responde con `valida:false` y un código explícito. No devuelve una aprobación por defecto. El custodio suministrado debe ser una implementación **del lado del servidor**, autorizada, independiente y con protección real contra retrocesos; una implementación simulada en las pruebas **no equivale a WORM desplegado**.

## Requisitos de custodia (antes de producción)

1. Generar una clave aleatoria de 32 bytes o más mediante un administrador de secretos/KMS, distinta de las claves JWT, cifrado de datos e idempotencia. No incluirla en GitHub, logs o documentos.
2. Tomar una instantánea consistente de `DecisionProof` y `DecisionChainHeadPersonal` y llamar a `crearAnclaVerificada` con el usuario autorizado. La emisión falla si la cadena es parcial, vacía, adulterada o de otro titular. No recibir estos argumentos desde el cliente sin consulta autenticada.
3. Publicar cada ancla en almacenamiento externo con política **WORM/retención inmutable** y permisos separados de la cuenta de aplicación. Conservar histórico de anclas: nunca sobrescribir una.
4. Para verificar, obtener de forma independiente la última ancla previamente emitida, llamar a `verificarAncla(ancla, clave, registros, head, usuarioEsperado)` con el identificador del usuario ya autenticado y contrastar contra la cadena completa y la cabeza actual. No extraer `usuarioEsperado` de la propia ancla ni del cuerpo de una petición sin autenticar. Rechazar cualquier retroceso o falta de anclas esperadas.
5. Automatizar alertas de discrepancias, rotación de clave con identificador de versión, recuperación y auditoría independiente antes de afirmar protección contra borrado total.
6. Confirmar que cada documento `DecisionProof` y `DecisionChainHeadPersonal` tenga `usuarioId` igual al usuario autenticado; el verificador falla cerrado si falta la titularidad o pertenece a otra cuenta. No aceptar conjuntos de registros enviados por un cliente como fuente confiable.

## Prueba de reescritura completa

La suite `decision-proof-external-anchor.test.js` incluye un ataque de reconstrucción completa: se sustituyen todos los registros por otros con hashes SHA-256 y enlaces válidos y se actualiza el encabezado para que coincida. La comprobación de la cadena reconstruida por sí sola resulta válida, pero `verificarAncla` debe devolver `ANCLA_NO_COINCIDE` al cotejar con el comprobante HMAC previo.

**Condición indispensable:** el comprobante anterior debe haberse conservado fuera de la base comprometida y su clave HMAC debe seguir protegida. La prueba no demuestra que esa custodia externa esté desplegada.

## Límites

- HMAC prueba autenticidad **solo mientras la clave no sea comprometida**; no aporta no repudio.
- Una base comprometida puede reescribir el historial *y* anclas almacenadas en la misma base; por ello la custodia externa es indispensable.
- El verificador actualmente exige cargar toda la cadena del usuario y **no** es apropiado para usuarios con historial ilimitado. La auditoría transaccional tiene un límite de 10 000 elementos y debe evolucionar a verificación por segmentos.
- No se almacena el contenido financiero en el ancla: únicamente identificador, secuencia, hash y fecha. El identificador sigue siendo dato potencialmente vinculable; controlar acceso.
- No publicar anclas antes de completar exitosamente la transacción que agregó la decisión. Deben ser posteriores al commit; almacenar el ancla externamente con reintentos e idempotencia.
