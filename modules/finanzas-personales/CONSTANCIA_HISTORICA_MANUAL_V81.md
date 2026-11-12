# Constancia histórica de intento manual — r72

## Partida y alcance
HEAD remoto 9d3eada5cba0f5c003628e3fd715ffd3deb28afd, árbol 8e52383f63c240474e9c80de48fab92ef84542de. #389 abierto sobre feature/finanzas-personales SHA 652126a03f19fbec3c529cad1e84bff11cd3699e; #407 abierto. Gate 43179849561, Seguridad 43179849598 y V81 43179849530 verdes. Revisadas instrucciones, README raíz/personal y continuidad; sin AGENTS.md local. Próximo ingreso/compra estricta ya resueltos, no se cuentan otra vez. Publicar con HEAD/base y lease comprobados, sin ejecuciones paralelas sobre rama.

Un bloque: constancia de fuente original/proyección y cierre explícito de incertidumbre en diario/legado para fuentes anuladas o con compensaciones. La consulta anterior devolvía estado sin vinculación completa suficiente para cerrar el control local de un intento histórico. Se preserva su contrato; la nueva ruta es separada y de solo lectura financiera.

## Plan y aceptación
| Caso | Criterio |
| --- | --- |
| Propiedad | Usuario del JWT verificado; búsqueda por usuarioId/hash de externalId; no elegir dueño en cuerpo |
| Coincidencia | Comparar fuente original completa con solicitud validada antes de emitir constancia |
| Consistencia | Fuente y cadena/proyección se leen en la misma transacción snapshot, sin escrituras financieras |
| Vinculación | Propietario, UUID, ID original, huella de solicitud normalizada, hash de campos financieros originales y compensación/proyección |
| Integridad | SHA256 de payload y HMAC-SHA256 con dominio separado; clave existente PERSONAL_IDEMPOTENCY_SECRET, mínimo 32 caracteres, sin secreto en cliente |
| Estados | ACTIVA, ANULADA o clasificación heredada CORREGIDA; proyeccionEstado conserva ACTIVA/ANULADA real leída |
| Cierre histórico | Solo ANULADA/CORREGIDA, constancia válida, cuerpo/clave iguales y confirmación del propietario; no pago activo ni reactivación |
| Control genérico | Resolver solo pendiente coincidente no activo; datos cambiados/callback de otra sesión no resuelven |
| Persistencia | Conservar cuerpo/UUID y constancia como HISTORICA; cierre repetido idéntico idempotente |
| Fallos | Respuesta genérica/alterada, fuente distinta, firma inválida en emisor, almacenamiento fallido o cancelación mantienen incertidumbre sin reenviar |
| Legado | Además exige huella exacta de JWT/cuerpo originales; archivo histórico conserva bytes y usa reconocimiento local posterior sin borrar |

POST /api/finanzas-personales/transacciones/constancia-intento exige el mismo esquema transaccional, restringido a ingreso/gasto MANUAL sin vínculos explícitos de préstamo/recurrencia ni metadatos externos. Responde constancia:null si no hay fuente del usuario; 409 ante mismo identificador con contenido diferente. Cache-Control private,no-store cubre éxito y errores de la ruta. La clasificación CORREGIDA significa fuente original con compensaciones; no identifica por sí sola el último tipo de evento. La UI dice CON COMPENSACIONES y la constancia incluye proyeccionEstado. Fuentes antiguas ya ANULADA requieren también lectura/proyección válida y no se les inventa un hash compensatorio.

El normalizador compartido public/finanzas-personales-constancia.js fija campos, trim validado por servidor y fecha ISO; firma y hash no dependen del orden del JSON. El backend importa ese código puro. Constructor/verificador HMAC permanecen en servicio personal. Sin nuevos modelos, índices, roles, dependencias o secretos. El emisor opcional no cambia confirmar-intento antiguo.

## Validación inicial
Local: módulo 637/628/9 y CI personal 353/349/4, cero fallos. Diez pruebas nuevas cubren MAC/cuerpo/propietario, errores, emisor después del cotejo, control/diario idempotentes, UI sin POST financiero, cancelación/alteración, respuesta tardía, cuota local, legado histórico y fuente antigua anulada sin proyección. Sintaxis y diff --check correctos. Integraciones omitidas localmente no son aprobación; CI exacta pendiente hasta publicar.

Harness Chromium/HTTP/JWT/Mongo autorizado amplía legado a ACTIVA/ANULADA/CORREGIDA y agrega dos casos de diario con POST original perdido tras compensación real. Exige consulta concurrente determinística, HMAC real verificado con clave efímera del servidor, otro usuario sin constancia, importe distinto 409, fuente original intacta, snapshot financiero sin cambios al consultar/cerrar, cuerpo/clave preservados, control resuelto y recarga sin otro POST. Todo sintético y aislado; no se toca información real.

## Límites y siguiente paso
La constancia es del servidor de la aplicación: no certificación externa, firma de tercero ni prueba de invulnerabilidad. El cliente coteja hash, vinculación y formato; no posee clave HMAC y confía en la API autenticada del mismo origen. La firma no autoriza ninguna escritura financiera y ninguna ruta de pago/restauración consume esta constancia como autorización. Un atacante que controla almacenamiento/scripts del navegador puede alterar estado local; la autorización financiera sigue en el servidor. Retención/rotación operativa de claves aún requiere evidencia real.

No certifica saldo ni estado actual después del snapshot: soloLectura=true, afectaCaja=false, autorizaGasto=false, certificaEstadoActual=false. El hash de fuente cubre campos financieros pertinentes más identidad/estado, no todos los metadatos Mongo. No sustituye cadena verificable ni custodio independiente. Un HMAC con acceso administrativo/clave comprometidos no ofrece custodia independiente.

Resolver control y guardar diario son dos escrituras locales, no una transacción financiera: si falla la segunda, cuerpo sigue PENDIENTE y bloquea asesoría; el reintento coteja constancia otra vez, sin duplicar fuente. Permanecen límites de sessionStorage/pestaña y 100 entradas sin poda automática. Un legado sin JWT original o datos suficientes continúa bloqueado: la constancia nueva no sustituye la huella antigua ni asigna dueño por aproximación.

Siguiente: comprobar consistencia ante restauración/correcciones posteriores a una constancia guardada y gestión de capacidad/archivo sin borrar originales; definir evidencia adicional para JWT original perdido. #407/custodio independiente real, backup independiente/retención/restore operacional RPO-RTO, roles/índices/credenciales productivos, auditoría y dispositivos/compatibilidad pendientes. Sin merge a feature ni Render, sin cambios de main/Empresarial/Blushéa/datos reales/planes.


## Evidencia real del núcleo y salvaguarda del formulario
SHA ff79bbb5102596031959fa38d708ee406b0e821a, árbol e603184dc72f273db9cd29205e33206122f7295d: Gate 43189856923, Seguridad 43189856913 y V81 43189856953 verdes. Job 131086110779: Mongo 81/81 y navegador/backend 10/10, cero fallos/cancelaciones/omisiones. FP_CONSTANCIA_HISTORICA confirma ANULADA/CORREGIDA con firma del emisor verificada, fuente original intacta, cuerpo/clave conservados, control resuelto, consulta concurrente, aislamiento y cero reactivaciones/POST adicionales. FP_LEGADO_EVIDENCIA acredita archivo ACTIVA/ANULADA/CORREGIDA con original global intacto. No certificación externa ni prueba de producción.
Se completa salvaguarda: al cerrar, limpiar importe/concepto solo si el formulario sigue siendo el original; un borrador editado durante la consulta permanece. La constancia original siempre queda en diario. Prueba específica cubre ambos casos, y el navegador exige campos originales vacíos tras cierre. Local módulo 638/629/9 y CI personal 353/349/4, once pruebas nuevas dirigidas, sin fallos; el descendiente requiere CI exacta. Siguiente: restauración/corrección posterior a constancia guardada, capacidad sin poda y prueba adicional para JWT original perdido. #407/operación/custodia/dispositivos pendientes; sin merge ni Render.
