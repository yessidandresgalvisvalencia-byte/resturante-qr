# Interfaz y recibos de imputación V81
2026-11-06 · Solo Finanzas Personales · PR #389 y bloqueo #407 abiertos.
Padre verificado ab9cf3ad02252e2a6e8ad1cbe38f58fc085168e8, árbol 0a6e58142ddb0926a95dad4c84bbde0d213affc9. Base feature/finanzas-personales 652126a03f19fbec3c529cad1e84bff11cd3699e. CI padre verde: Gate 42177440249, Seguridad 42177440253, V81 42177440271; Mongo 77/77.

## Plan y aceptación
Completar revisión de pagos existentes desde Deudas: seleccionar préstamo propio, consultar pagos activos y ciclo actual, comparar origen, importe, cuenta, fecha Colombia y ciclo original, elegir aplicar/excluir/anular y confirmar con motivo. No repetir ni modificar pagos, capital o caja. Anular una decisión conserva el historial y permite revisión posterior.
Conservar formulario y cuerpo exacto antes del POST, por usuario y pestaña, con clave estable. Una respuesta perdida solo se resuelve por recibo vinculante o reenvío manual exacto; actualizar saldos no prueba el resultado. Bloquear doble envío, recibo ajeno/discordante, almacenamiento fallido, selección/contexto cambiado y respuesta de otra sesión.
La interfaz usa nodos de texto, etiquetas y estados accesibles. Limpiar sesión borra solo la vista, no solicitudes ni datos originales. HTML anterior sin panel no falla. Nuevas referencias de script evitan mezclar activos cambiados.

## Contrato de recuperación
GET /prestamos/:id/imputaciones/recibos/:clave es solo lectura, bajo propietario JWT y snapshot; verifica cadena/cursor antes de devolver resultado.recibo. No encontrado = 404, nunca confirma por ausencia.
POST original devuelve también resultado.recibo: propietario, préstamo, ruta/método, clave, huella SHA del cuerpo exacto, hash de evento, confirmado:true, certificaEstadoActual:false, afectaCaja:false y noAplicada. El control de mutaciones exige la correspondencia completa antes de desbloquear.
La interfaz envía X-GRUK-Resolver-Imputacion:1 para resolver de forma durable un contexto o decisión superados: el servidor conserva un evento firmado noAplicada:true (CONTEXTO_CAMBIO o DECISION_NO_VIGENTE) sin reemplazar la decisión financiera previa. Retorna 200 con recibo de no aplicación; replay conserva ese mismo resultado y no escribe. Clientes anteriores sin ese modo siguen recibiendo 409. Las validaciones de propietario, fuente íntegra, calendario confirmado, clave, índices y capacidad siguen siendo obligatorias; errores no verificables permanecen pendientes.
Los nuevos campos son opcionales sin backfill. Solo se incluyen en hash/HMAC cuando existen, preservando bytes y hashes anteriores. Un cierre no aplicado avanza auditoría/cursor, sin variar caja, principal, saldo ni originales. Sigue protegido por rol INSERT-only y backup V19 (39 colecciones); sin nueva colección ni servicio.
El recibo acredita la solicitud original, no la vigencia de la decisión ni capacidad para gastar. Después se invalida autorización local y se consulta estado financiero fresco.

## Evidencia y límites
Local Node 24: módulo 585 casos / 576 aprobados / 9 omitidos / cero fallos; CI personal 338/334/4; dirigidas 62/62; siete pruebas nuevas de interfaz y una de cadena/recibo. Sintaxis y diff --check satisfactorios.
Nuevo ensayo Mongo autorizado recorre controlador DOM, control de mutaciones, handler y servicios reales: commit con respuesta perdida, recarga y recuperación GET sin segundo POST; cierre no aplicado por cambio auditado de vencimiento, replay, aislamiento de recibos, exclusión y anulación conservando fuente/cuenta/capital. Resultado del SHA publicado pendiente de observar.
Pruebas locales de interfaz cubren cuerpo/clave invariables, recibo ausente, no aplicación, doble envío, respuesta tardía de otra sesión, recibo ajeno, almacenamiento fallido, edición durante confirmación, HTML anterior y texto sin innerHTML.
Compatibilidad de inicio de sesión/dictado preservada y comprobada. No se verificó visualmente Chromium: Playwright está disponible pero falta ejecutable chromium_headless_shell-1234; no se descargó navegador ni se contrató servicio. DOM sintético no acredita aprobación visual ni dispositivos reales.
Diario local limitado a 100 solicitudes sin limpieza automática; no es backup independiente y perder almacenamiento de pestaña puede perder el borrador local. El evento y recibo del servidor se conservan. Historial/huellas no sustituyen protección de acceso, custodia o claves operativas. No se afirma que todos los fallos puedan cerrarse automáticamente.

## Siguiente y bloqueo de liberación
Revisar recuperación de pagos anulados tras cambio de ciclo y decisiones de imputación: conservar restricciones, no reescribir fuentes y añadir evidencias antes de ampliar restauración. Validación visual/dispositivos y accesibilidad real pendientes.
#407 mantiene custodia independiente real, roles/índices y separación de credenciales en producción, backups independientes/retención/acceso, restauración aislada operativa con RPO/RTO, auditoría IP/dispositivo y aceptación integral de seguridad, exactitud, concurrencia, migración, aislamiento y recuperación. No merge a feature, no despliegue parcial Render, no cambios main/Empresarial/Blushéa ni costos.
