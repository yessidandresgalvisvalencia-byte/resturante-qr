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


## Integración real y ajuste del contexto de prueba
Código a5fa9c181df3a09f98bca9e575bd4a5545653225, árbol a6a9d86221c84f5d0943deced81639389e45efd3. Seguridad 43157734673 y V81 43157734645 aprobados; job 130981480702: Mongo 81/81, navegador/backend 5/5, sin fallos/omisiones. FP_MANUAL_EN_VUELO confirma commit real con respuesta retenida, cambio de sesión HTTP, cero confirmaciones con otro JWT, cero reenvíos, control pendiente intacto, fuente única y confirmación del propietario sin escrituras.
Gate 43157734736 falló en dos subcasos del mismo fixture sin token definido tras exigir sesión al guardar. Se incorpora token/revisión al contexto simulado de confirmacion-compensada-interfaz.test.js; aserciones de ANULADA/CORREGIDA, conservación de clave, ausencia de confirmación/carga y liberación del botón se conservan. Fixture corregido y nuevas pruebas 7/7 locales. No se omiten pruebas ni cambian gates. Requiere CI exacta del descendiente. Siguiente: diario manual por propietario con cuerpo/clave/recibo recuperables, sin borrar legado de dueño incierto. Límites y #407 pendientes, sin merge ni Render.


## Carrera observada al preparar cambio de sesión
En 9668c8f434d207eaeddcf7e2c1c43593efee7b61, Gate 43158125423 y Seguridad 43158125560 aprobaron. V81 43158125313 falló en el harness: Mongo nativo 81/81; navegador esperaba pulsar Inicio después de revocar, pero una actualización automática ya había recibido 401 y ocultado app (locator no visible, 30 s). El código aislaba la continuación; el ensayo suponía un orden único. Se invoca condicionalmente el handler real de Actualizar si app sigue visible y se espera el mismo cierre 401; si ya ocurrió se continúa. No cambia autorización, aserciones ni timeouts. Todas las invariantes financieras/aislamiento/control pendiente y confirmación con propietario siguen obligatorias. Descendiente requiere CI exacta.


## Cierre verificado r69
SHA 74d782a89505be2057925bacd405fcf80a2b222c, árbol 9d14680db15a2bf76ec87f582e8cb3dfa86f860c: Gate 43158519418, Seguridad 43158519476 y V81 43158519395 verdes. Job 130983975535: Mongo autorizado 81/81 y navegador/backend 5/5, cero fallos/cancelaciones/omisiones. FP_MANUAL_EN_VUELO confirma nuevamente commit real, respuesta retenida, cambio de sesión HTTP, ninguna consulta con otro JWT ni reenvío, control pendiente conservado, fuente única y confirmación del propietario sin escrituras adicionales. Cinco pruebas nuevas locales y módulo 628/619/9, CI personal 338/334/4; fixture de confirmación y nuevas pruebas 7/7. Se conservan en el historial fallos de fixture y carrera de preparación, con sus correcciones; no se desactivó ningún gate. El descendiente documental exige también CI exacta verde al cerrar. Próximo imprescindible: diario manual por usuario con cuerpo/clave/recibo recuperables y legado conservado; limpiar campos privados al cambiar de cuenta solo cuando su cuerpo sea recuperable. No se afirma recuperación manual integral. #407/custodia/operación/dispositivos siguen pendientes. Sin merge a feature ni Render, sin cambios a main/Empresarial/Blushéa/datos reales/planes.
