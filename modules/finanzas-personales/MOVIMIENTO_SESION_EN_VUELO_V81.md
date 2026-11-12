# Movimiento manual en vuelo y cambio de sesión — r69

## Partida, plan y defecto
HEAD remoto e92ae5ef771986630647b6767c4583f74e76412a, árbol 248e71abaac9c2669b1a028d0e680b51ffe7737d. PR #389 abierto sobre feature/finanzas-personales SHA 652126a03f19fbec3c529cad1e84bff11cd3699e; #407 abierto. Gate 43150814323, Seguridad 43150814340 y V81 43150814389 verdes. Instrucciones, README raíz/personal y continuidad revisados; sin AGENTS.md local. Próximo ingreso/compra estricta ya resueltos en checkpoints anteriores, no se cuentan de nuevo.

Un bloque: aislar callbacks del registro manual durante preparación y respuesta pendiente. La función anterior usaba manualExternalId/manualPayloadPendiente globales tras await sin comprobar identidad. Reproducción controlada: una respuesta exitosa tardía limpiaba intento y formulario de B; una fallida podía consultar confirmar-intento con token/payload actuales. La corrección captura token y revisión de sesión; descarta continuación después de clave, POST, confirmación y fallos de actualización. Cancelar solicitudes incrementa revisión y libera botón; un finally viejo no cambia el botón de la nueva sesión. El digest comprueba revisión antes de escribir clave, incluso si vuelve el mismo JWT.

## Aceptación
| Caso | Criterio verificable |
| --- | --- |
| Respuesta exitosa vieja | No limpia intento/formulario nuevo, no muestra éxito ni carga datos |
| Error viejo | No consulta con JWT/payload de otra sesión, no publica error privado |
| Clave o digest en vuelo | No instala intento viejo ni escribe clave tras cambio de revisión |
| Misma sesión | Confirma una vez, actualiza panel y libera botón |
| Interrupción real | Commit HTTP/Mongo previo a respuesta retenida; JWT revocado y nuevo login no generan otra transacción |
| Recuperabilidad del control | Identificador/huella pendientes del propietario permanecen aislados; otra cuenta no obtiene fuente financiera |
| Confirmación de propietario | Consulta posterior con nuevo JWT verifica intento sin otra escritura financiera |

Pruebas controladas movimientoSesionTardia.test.js: función real y dobles de API/DOM/crypto para respuesta, error, clave y digest tardíos. Se conservan contratos de monto exacto, doble envío y cancelación. Solo se actualizan mocks DOM y expectativas necesarias por variable local; no se omiten casos.

Ensayo real MOVIMIENTO_MANUAL_EN_VUELO_CAMBIO_SESION en backend-recuperacion.browser.cjs: Chromium/HTTP/JWT/Mongo reales, respuesta retenida tras commit, revocación de tokenVersion, refresh 401, login B en la misma página, liberación de respuesta vieja, cero consultas automáticas de confirmación y un solo movimiento de A. Compara snapshot antes/después y control pendiente en sessionStorage; confirma intento con nuevo JWT A sin cambios financieros. No usa datos reales ni conexiones externas.

## Evidencia inicial y límites
Local: módulo 628/619/9, suite CI personal 338/334/4, sin fallos. Cinco pruebas nuevas dirigidas satisfactorias; sintaxis y diff --check correctos. Integraciones omitidas localmente requieren CI del SHA publicado; pendientes hasta comprobarlas. Versión del script personal y contratos actualizados conjuntamente.

No es una solución de recuperación manual integral: el intento manual legado usa una clave global y huella ligada al JWT; clearToken/enter todavía limpian esa clave y el formulario manual no dispone de un diario completo por propietario con cuerpo y recibo restaurables. El control general conserva id/huella pendiente y bloquea recomendaciones mientras no se confirma; eso no equivale a conservar el cuerpo completo ni a recuperación entre pestañas/dispositivos. El ensayo conserva el cuerpo en el harness únicamente para consultar la fuente, no acredita que la aplicación lo recupere automáticamente. Tampoco prueba por sí solo borrado de memoria local o copia independiente.

Siguiente prioridad: diseñar/probar diario manual por propietario que conserve cuerpo exacto, clave y recibo ante logout/JWT renovado, con recuperación explícita, sin trasladar datos entre cuentas. Conservar legado sin atribuir dueño incierto ni borrarlo automáticamente; reproducir antes de migrar. Revisar también limpieza de campos privados de movimiento al cambiar de usuario una vez que su solicitud quede recuperable. Ambos pendientes bloquean liberar este flujo como recuperación completa.

#407/custodio independiente real, roles/índices/credenciales productivos, respaldo independiente protegido/retención/restauración operacional RPO-RTO, revisión independiente, dispositivos y compatibilidad siguen pendientes. Sin merge a feature ni Render; sin cambios en main/Empresarial/Blushéa ni datos reales; sin planes o servicios nuevos. No certificación externa ni garantías absolutas.
