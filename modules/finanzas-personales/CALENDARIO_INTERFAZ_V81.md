# Interfaz y recuperación del calendario V81

5 de noviembre de 2026. Alcance: un bloque funcional de interfaz sobre la API de calendario por eventos. Publicación GitHub; sin despliegue ni datos reales.

## Comportamiento

La pestaña Calendario de ingresos consulta conjuntamente calendarios gestionados y legados del propietario en una transacción snapshot. Los anteriores se muestran con identidad/procedencia/estado, en solo lectura, sin copiar, adoptar, deduplicar o desactivar fuentes. El listado completo habilita creación/edición; fallo, listado parcial, propietario distinto o respuesta obsoleta no habilitan cambios. El límite de revisión de legados es 500; excederlo da 422 sin subtotal ni limpieza.

Crear/corregir usa concepto, pesos enteros, día original, fecha civil y motivo explícitos. Retirar/restaurar exige motivo, identidad/versión consultadas y confirmación visible. Se preservan las condiciones API del bloque previo: programar no registra ingreso, no mueve caja ni confirma recepción; fecha gestionada pasada/hoy permanece pendiente. Después de confirmar se invalida la vista anterior; se consulta de nuevo para ver el estado actual. Un recibo original no revive una versión histórica ni habilita gasto.

El formulario y cada solicitud exacta con su clave se guardan por usuario antes de POST en sessionStorage. La respuesta perdida conserva PENDIENTE; al recargar se recupera con GET de recibo sin otro POST. Reenviar requiere acción y confirmación explícitas, mismos datos y clave. No hay reintento automático ni limpieza de originales/pendientes/confirmadas. Texto escrito durante la verificación asíncrona se combina con el acuse sin sobrescribirlo. Tras confirmar, una nueva creación requiere Nuevo; no se repite silenciosamente el formulario ya enviado.

La recuperación valida identidad derivada del calendario, clave, acción, versión, huella del cuerpo exacto y banderas del recibo. El control financiero compartido conserva incertidumbre mientras no haya prueba y retira solo la operación vinculada. Un pago incierto independiente permanece bloqueado aunque se recupere el calendario. Cambio de token/usuario/revisión o respuesta de consulta más antigua se descarta; cerrar/cambiar sesión limpia solo vista, conservando estado propio recuperable.

409 genérico de calendario no se interpreta como rechazo definitivo. Cuando el servidor verifica en snapshot que la versión del calendario propio ya superó la solicitada, devuelve rechazoCalendario VERSION_SUPERADA vinculado a clave, identidad, huella, versión esperada/actual y hash vigente. Con índices de versión y orden INSERT-only, esa solicitud antigua no puede insertar su versión después. El cliente comprueba esa evidencia antes de resolver su incertidumbre; conserva cuerpo y rechazo y exige actualizar/seleccionar otra versión. Una versión esperada futura o un conflicto concurrente sin esa prueba siguen pendientes. Este rechazo no es un recibo persistido ni certifica estado financiero actual; la protección frente a credenciales administrativas sigue sujeta a #407.

## Integración

HTML, script principal, controlador financiero y nuevo script de calendario se versionan juntos con 20261105-calendario-interfaz-v81. No se cambian modelos, índices, roles ni respaldo V18 (38 colecciones). El lector de legados añade una consulta acotada dentro de la misma sesión de listado; no hace escrituras. API mantiene JWT/entitlement/limitador/no-store del bloque anterior.

No se modifica el service worker compartido ni funcionalidades de Empresarial/Blushéa. Los recursos nuevos tienen URL versionada. La interfaz conserva las secciones personales anteriores y sus cancelaciones de sesión. El montaje de calendario se sitúa fuera del fragmento de dictado; se mantuvieron las nueve regresiones de dictado sin sustituirlas por stubs del calendario.

## Aceptación delimitada

| Criterio | Evidencia |
| --- | --- |
| Formulario/solicitud conservados antes de enviar, recarga y mismo reenvío | Pruebas DOM/controlador y nueva integración HTTP con almacenamiento real de ensayo |
| Crear, corregir, retirar, restaurar y ver historial | Controlador de interfaz ejecutado sobre API principal real, JWT y MongoDB aislados, pendiente CI exacta |
| Aislamiento, respuestas tardías, texto durante digest y consultas fuera de orden | Catorce pruebas dirigidas nuevas de interfaz/control/API |
| Recibo vinculado, 409 incierto y versión superada sin liberar pagos ajenos | Validación criptográfica del contenido y pruebas del control financiero compartido |
| Legados conservados y XSS por concepto evitado | Solo textContent/nodos, lectura propia; comparación del original legado en fixture autenticado |
| Integración con código y caché versionados | Tres controles de versión existentes actualizados; sintaxis y suite del módulo |

Local: 488 casos/479 aprobados/nueve integraciones omitidas/cero fallos. Catorce dirigidos y tres controles de versión aprobaron; sintaxis general/dirigida y diff correctos antes de publicar. Hay solapamiento; no sumar como casos únicos. La integración autenticada ampliada todavía requiere CI del SHA publicado: controlador + API principal real, respuesta perdida tras commit, recarga/GET, edición/retiro/restauración, historial, versión superada y comparación de fuentes/caja.

## Límites y siguiente paso

sessionStorage es de pestaña, sin cifrado contra JavaScript del mismo origen; no es respaldo independiente ni recupera información nunca recibida tras pérdida del dispositivo. Capacidad local 100 solicitudes, falla cerrada sin borrar; archivo/exportación explícitos quedan pendientes. No se muestran ni almacenan tokens en el diario local de solicitudes. Los eventos recibidos permanecen en el respaldo independiente pendiente de operación real.

Pruebas de esta ejecución usan DOM determinista/VM y HTTP/MongoDB aislados. No hay navegador Chromium/Firefox ejecutable en este entorno (Playwright está instalado sin binario); no se acredita revisión visual, accesibilidad integral ni aprobación en iPhone/Android/escritorio reales. Esa aceptación permanece pendiente antes de producción; no se simula evidencia con capturas inventadas.

Siguiente: adopción explícita de calendario legado con versión de fuente y eventos, sin reescribir original ni duplicar planificación; luego recepción por ocurrencia idempotente sin duplicar ingreso/caja. Completar revisión visual/dispositivos, capacidades de recuperación y demás flujos. #407/custodio independiente real/respaldo completo durable-retención-acceso-claves separados/restauración-RPO-RTO operativos/roles-índices-históricos reales/seguridad/compatibilidad e informe final siguen pendientes. Sin merge a feature ni Render, costos, borrados, migraciones o restauraciones sobre datos reales.


## Cierre funcional verificado del código

Código `d8de3ca6216f6de37b879ba82a150852e2f2adeb`, catorce archivos cotejados byte a byte contra GitHub. [Gate 42050731298](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42050731298), [Seguridad 42050731315](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42050731315) y [V81 42050731303](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42050731303) success; siete jobs V81 y 65 pruebas MongoDB autenticadas/cero fallos. No hubo fallos de CI del núcleo publicado. La prueba autenticada existente se amplió; el total no aumenta por cada aserción o paso de interfaz.

El fixture ejecutó el controlador de interfaz y la función api real extraída del script principal sobre Express/router/JWT/MongoDB aislados. Conserva solicitud/formulario antes de POST; se pierde deliberadamente la respuesta después del commit y la recarga recupera por GET: un solo POST de creación, local CONFIRMADA y control financiero desbloqueado solo para esa operación. Flujo de interfaz crea 500, corrige a 650, retira y restaura la misma identidad hasta versión 4; historial propio incluye los cuatro eventos. Una corrección externa cambia a 700/version 5: la selección anterior recibe VERSION_SUPERADA, queda conservada como RECHAZADA con evidencia, no retira el calendario y permite nueva revisión. Son cinco intentos POST explícitos, sin duplicación por recargar. El legado propio inactivo aparece con su texto original (incluido texto similar a HTML), no se altera; el usuario distinto no lo ve. No existen cuentas, transacciones ni outbox nuevos para ese usuario del flujo de interfaz.

Catorce dirigidos confirman también cambio de usuario, respuesta tardía, fallo de almacenamiento, mismo reenvío, recibo incorrecto, listados fuera de orden/incompletos/ajenos y preservación de pago real incierto independiente. En revisión final se corrigió Nuevo para conservar el formulario, incluido texto escrito durante la verificación: habilita otra intención explícita sin borrar campos. La regresión asíncrona se amplía para pulsar Nuevo y comprobar texto y almacenamiento; catorce dirigidos finales aprobaron. La confirmación de creación recuerda cancelar si corresponde al mismo ingreso ya listado. El siguiente commit incluye ese ajuste y este cierre; necesita sus tres CI exactas antes de retomar.

Local final: 488 casos/479 aprobados/nueve omitidos/cero fallos, sintaxis general/dirigida y diff correctos. Catorce dirigidos y tres controles de versiones aprobados; hay solapamiento, no sumar como casos distintos. Las omisiones locales solo se acreditan dentro del alcance ejecutado por CI autenticada.

Ensayo backup V18 del núcleo: 38 colecciones/5340 documentos/3469394 bytes, captura 122 ms, restauración 2625 ms, edad 2747 ms. BSON/índices conservados en base aislada vacía; custodiaIndependiente=false/rpoProduccion=false. No prueba custodia/retención durable ni recuperación/RPO/RTO de producción. No cambian esquemas, roles, índices o formato; no hubo datos reales, migraciones, borrados ni restauraciones productivas.

El bloque funcional de interfaz cumple esta matriz de DOM/controlador/HTTP, sin dar por completada aceptación visual/dispositivos: no hay navegador ejecutable en el entorno y no se inventan capturas o aprobación de iPhone/Android/escritorio. sessionStorage sigue limitado a pestaña/mismo origen/capacidad 100 sin limpieza; archivo/exportación y protección operativa pendientes. Próximo bloque: adopción explícita de calendario legado con huella de fuente, versión, copia del original y eventos idempotentes, evitando duplicación de planificación sin reescribir fuente; después recepción por ocurrencia y demás flujos. Mantener #407, custodio real, backup completo durable-retención-acceso-claves separados/RPO-RTO-restauración operativa, roles/índices/históricos reales, seguridad/compatibilidad/revisión visual-dispositivos/informe final pendientes. Sin merge a feature ni Render, costos o cambios de datos reales; originales y pendientes antiguos conservados.

El checkpoint intermedio `04b5d1fcb76b19ca67522af911a9ec4b9711e296` aprobó Gate 42051616348, Seguridad 42051616249 y V81 42051616341. El ajuste posterior de carga parcial añade una regresión (15 de calendario/interfaz + nueve de dictado, 24 dirigidas aprobadas); sintaxis y diff correctos. Su siguiente commit mantiene el mismo lote/versión de assets, todavía sin despliegue, y requiere CI exacta antes de retomar.
