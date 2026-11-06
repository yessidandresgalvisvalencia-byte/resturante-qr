# Consultas y operaciones monetarias pendientes

POST /consulta no registra movimientos de dinero. Puede guardar contexto conversacional o actualizar propuestas de progreso; no se certifica como una ruta sin ninguna escritura de metadatos. El control del cliente deja de iniciar una operación monetaria únicamente para ese método y ruta exactos. No extiende la excepción a /copilot, aprobaciones, rutas desconocidas ni métodos PATCH/DELETE.

Antes de enviar /consulta el cliente exige un control local de pendientes verificable y sin bloqueos. Captura dueño y revisión financiera, y los comprueba al recibir respuesta o error. Una mutación confirmada, rechazada o incierta durante la consulta cambia la revisión: no se muestra el consejo anterior aunque el bloqueo ya se haya resuelto. El formulario conserva además una revisión de pregunta: solo pinta la última solicitud de la sesión visible. Salir de sesión invalida esa revisión incluso si se vuelve con el mismo token. Una invalidación financiera retira el consejo visible.

| Criterio | Evidencia requerida |
| --- | --- |
| Fallo de lectura | Red perdida, rechazo HTTP o respuesta inválida no crean registros sin_clave, no cambian revisión financiera y permiten una nueva consulta |
| Escritura incierta | Un gasto cuyo commit ocurrió y cuya respuesta se pierde conserva su pendiente; consultar no lo elimina ni vuelve a contabilizarlo |
| Barrera previa | Pendientes reales o registro local corrupto impiden enviar la consulta; sin borrar ni normalizar el almacenamiento |
| Carrera | Mutación durante lectura descarta respuesta anterior, aun confirmada la escritura; siguiente consulta requiere estado vigente |
| Sesión y orden | Preguntas fuera de orden, fallos tardíos, cambio de cuenta, panel oculto y salida/reingreso con mismo token no sustituyen la vista vigente |
| Presentación | Respuesta de aplicación verificada, texto no vacío y textContent; no inserta HTML recibido |
| Integración financiera | MongoDB autenticado: consulta real con respuesta perdida conserva fuentes y no crea incertidumbre; gasto real perdido sí bloquea hasta confirmar el mismo externalId; posterior Disponible Hoy refleja ese gasto sin repetirlo |

JavaScript personal y controlador se versionan juntos como 20261104-consultas-pendientes-v81. No se cambia el formato del registro de pendientes ni se guarda el contenido de preguntas o importes en él.

Un registro sin_clave antiguo contiene una huella, no la ruta y el cuerpo originales. No permite distinguir de forma fiable una consulta de una escritura legítima. Se conserva bloqueado y requiere revisión con evidencia de su origen; no se limpia automáticamente, ni se confirma solo leyendo saldos. Este lote previene casos nuevos y no declara recuperados esos casos antiguos. La revisión de otras operaciones sin recibo recuperable sigue pendiente.

El control es local a este navegador; no acredita coordinación entre dispositivos ni se considera autorización del servidor. Las rutas financieras conservan autenticación, validaciones y transacciones propias. Quedan otras intenciones conversacionales, históricos, dispositivos reales y gates operativos de #407, incluido custodio independiente y recuperación de producción. No desplegar parcialmente.
