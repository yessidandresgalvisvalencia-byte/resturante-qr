# Archivo explícito de legado manual verificable — r71

## Partida y plan
HEAD remoto 48f68449b84f479f04720642256386692543732c, árbol 9fb20305c986a589bfeccefe840a4533dee99fa8. #389 abierto sobre feature/finanzas-personales SHA 652126a03f19fbec3c529cad1e84bff11cd3699e; #407 abierto. Gate 43172323344, Seguridad 43172323206 y V81 43172323205 verdes. Instrucciones/README raíz/personal/continuidad revisados, sin AGENTS.md local. Próximo ingreso y compra estricta ya constan resueltos, no se repiten. Sin ejecución paralela en rama; publicar con HEAD/base comprobados y lease.

Un bloque: recuperar/archivar el intento global antiguo solo cuando su huella, sesión actual y cuerpo original coinciden y el servidor confirma una fuente propia activa. No escribir ni reenviar una transacción para probar titularidad. El formato antiguo solo guarda id/huella: no permite deducir dueño/cuerpo ni recuperar un JWT distinto por sí solo.

## Condiciones y aceptación
| Caso | Resultado |
| --- | --- |
| Sesión/cuerpo coinciden | SHA256 de JSON.stringify([JWT actual,datos originales]) debe igualar huella antigua; conserva orden original de campos |
| Otra cuenta/JWT renovado/importe alterado | Rechazar antes de consultar; mantener bytes y bloqueo, no reasignar dueño |
| Confirmación explícita | Presentar UUID, tipo, importe, concepto, fecha y alcance de solo lectura antes de consultar fuente |
| Fuente propia activa | API existente con JWT verificado y comparación de cuerpo/clave devuelve confirmado/existe/ACTIVA/transaccionId válidos |
| Sin fuente o estado histórico | No adoptar como confirmación activa, no reenviar, no liberar bloqueo |
| Archivo | Conservar cuerpo/UUID/recibo y bytes exactos/huella del legado en diario del propietario; no modificar original global |
| Reconocimiento | Después de guardar archivo, registrar marcador local de los mismos bytes; no contiene saldos ni datos del dueño |
| Fallo entre pasos/carrera | Archivo ya guardado permanece; legado no resuelto sigue bloqueado. Reintento no duplica entrada; bytes cambiados invalidan reconocimiento |
| Cambio de sesión | Callback tardío no archiva ni pinta para nuevo usuario |
| Evitar nuevo duplicado | Limpiar importe/concepto solo si formulario sigue igual al confirmado; original completo permanece en archivo |

La UI usa el mismo constructor de cuerpo que Guardar movimiento para preservar el orden del hash antiguo. El botón Consultar y archivar legado con los datos del formulario no ejecuta POST /transacciones: únicamente consulta POST /transacciones/confirmar-intento, que usa transacción de lectura y usuarioId del JWT. Ni un ok genérico ni una coincidencia parcial constituyen aceptación.

Los originales financieros y sus auditorías permanecen sin cambios. El archivo y reconocimiento son metadatos locales, no una nueva certificación ni auditoría append-only del servidor. No se crean modelos, permisos, índices, migraciones o servicios.

## Evidencia inicial
Local: módulo 627/618/9; suite CI personal 353/349/4, sin fallos. Diecisiete contratos del diario incluyen cinco nuevos: JWT/huella exactos, archivo idempotente, fallo del segundo paso/cambio de bytes, consulta sin POST financiero, rechazo sin fuente/confirmación y callback tardío. Conservan casos de conservación, importes, almacenamiento, aislamiento y asesoría bloqueada. Sintaxis y diff --check satisfactorios. Integraciones omitidas localmente requieren CI exacta, pendiente al publicar.

LEGADO_MANUAL_CON_HUELLA_Y_FUENTE_PROPIA en backend-recuperacion.browser.cjs usa Chromium, JWT/HTTP/Mongo reales aislados y dos contextos: otra cuenta y un importe alterado no consultan; el propietario con JWT original vigente consulta una vez, archiva fuente propia y conserva cuerpo/bytes/UUID. Captura snapshot financiero previo/posterior; cero POST financieros desde la UI de archivo y ninguna fuente nueva en la otra cuenta. No se usan datos reales.

## Límites y siguiente paso
El hash antiguo está ligado al JWT exacto y a los bytes/orden del cuerpo anterior. Un JWT renovado, espacios distintos, fuente normalizada, anulada/corregida o cuerpo desconocido mantienen bloqueo. No se afirma recuperar todos los legados: no sustituir la huella, atribuir dueño por aproximación ni inventar datos. El flujo requiere el formulario original y sesión original todavía válida; el servidor vuelve a autorizar cada consulta. La UI no acepta un token vencido para autorizar.

El marcador local solo evita bloquear a otras cuentas por un legado ya archivado; conserva los bytes globales y es invalidado si cambian. Como el resto de sessionStorage, puede ser manipulado por scripts del mismo origen: no es una frontera de autorización ni una prueba contra un atacante local. Las fuentes financieras y su autorización son del servidor. No se promete atomicidad entre dos escrituras de navegador; se verifica archivo primero y reconocimiento después, con reintento idempotente y fallos cerrados. Persisten límites de pestaña/almacenamiento y máximo 100 entradas sin poda automática.

Siguiente: evidencia de servidor vinculante para fuentes originales ya anuladas/corregidas, conservando originales y resolviendo el control de incertidumbre sin repetir caja; establecer qué evidencia adicional permite tratar un legado cuyo JWT original ya no existe. No eludir ese bloqueo si no hay prueba suficiente. Capacidad/archivo de diario sin limpieza automática pendiente.

#407/custodio independiente real, backup separado protegido/retención/restore operacional con RPO-RTO, roles/índices/credenciales productivos, revisión independiente, dispositivos/compatibilidad pendientes. Sin merge a feature ni Render; main/Empresarial/Blushéa y datos reales sin cambios, sin planes/servicios nuevos.
