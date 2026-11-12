# Recuperación con fallo de conexión y retiro de cifras anteriores · V81

## Plan del lote r76 · 12 noviembre 2026

Padre remoto comprobado `b0295e3bbbb371b91abec521e4547353a6f8d371`, árbol `a175aaf17479e269e43c66c634f150cd9fd8f287`. PR #389 abierto en `integration/fp-hormiga-clasificacion-credito-v81`, base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`. Gate 43216076914, Seguridad 43216077023 y V81 43216077016 del padre verdes. #407 revisado, continúa abierto. Instrucciones, README y continuidad revisados, sin AGENTS.md local. Trabajo solo y con lease. La validación de próximo ingreso y compras de gastoInteligentePersonal ya consta implementada/verificada en continuidad; no se cuenta otra vez como avance.

Un bloque funcional: recuperar el diario en una aplicación ya abierta cuando la conexión falla, retirar cifras/recomendaciones anteriores y descartar lecturas iniciadas antes de la recuperación. Importar continúa siendo local, explícito e idempotente, sin reenviar movimientos. No se afirma que una primera carga sin red funcione ni que todas las funciones sean offline.

## Hallazgo y aceptación

Recuperar una copia añadía correctamente el bloqueo de pendientes a C3, pero dejaba sin invalidar de inmediato las cifras visibles y la revisión de lecturas anteriores. El callback nuevo alRecuperar solo se emite tras una activación real y con sesión vigente; repetir una recuperación ya realizada no vuelve a invalidar ni repone datos antiguos.

- Incrementar revisión de recuperación en memoria, combinada con la revisión financiera observada por el panel y los controladores. Una lectura anterior no puede rehabilitar Disponible Hoy, compra o asesoría tras recuperar, incluso si la copia no tiene pendientes.
- Invalidar importes de tablero, informes/patrimonio, resultados financieros y recomendaciones visibles. Marcar No actualizado y exigir nueva consulta con conexión. Conservar borradores de formularios, cuerpos/UUID, originales, archivos y otros diarios. No llamar a limpiarIntentoManual, borrar almacenamiento o hacer carga automática de red desde la recuperación.
- El wrapper API descarta GET y consultas financieras identificadas iniciadas antes de recuperar. No descarta por esa revisión una respuesta de una mutación financiera real: su confirmación conserva su propio control existente.
- Consulta de inversión y evaluación de gasto se reconocen como asesoría sin efecto de caja, con bloqueo de pendientes y revisión vigente antes/después de esperar. No crear una operación sin clave por consultar inversión. No se resuelven, eliminan ni migran incertidumbres conservadas por versiones anteriores; requieren evidencia y revisión explícitas.
- Recuperar sin conexión en una pestaña ya autenticada conserva raíz/páginas y deja el pendiente. Intentar consultar sin red falla sin reenviar ni cambiar cuerpo/clave. Reconectar y actualizar panel no confirma ni reenvía. Solo consulta explícita posterior con JWT/cuerpo originales puede resolverlo. Error HTTP 503 también mantiene la incertidumbre en pruebas controladas.
- Cambio de sesión descarta consulta tardía sin pintar ni confirmar en otra cuenta. No falsificar saldos ni afirmar que la copia acredita caja actual.

## Implementación y validación local

`public/finanzas-personales-manual.js`: callback posterior a recuperación nueva; no callback idempotente ni al fallar/cambiar sesión. `public/finanzas-personales.js`: revisión de recuperación, retiro de vistas de cifras sin borrar borradores y rechazo seguro LECTURA_ANTES_RECUPERACION en respuestas antiguas de lectura. Guardas de gasto/inversión comprueban operaciones pendientes. `public/finanzas-personales-control-mutaciones.js`: inversión de inteligencia clasificada como consulta financiera, no asiento. Versiones HTML y contrato de recursos actualizados juntos.

Diez pruebas nuevas: siete en recuperacionDiarioConexion.test.js (DOM real del controlador con VM, revisión, borradores, activación/idempotencia, fallos red/503, sesión tardía e integración, carga load real que no consume home anterior) y tres en panelMutacionesFinancierasFrontend.test.js (GET/asesoría en vuelo, bloqueo previo al fetch e incertidumbre histórica intacta). No se depende de APIs privadas expuestas en el navegador. Pruebas dirigidas iniciales detectaron que clasificar asesoría sin excluir su registro de mutación cambiaba la revisión durante la propia consulta; se corrigió la clasificación consistente, sin eliminar el caso.

Local: módulo 675 casos, 666 aprobados/nueve omitidos por servicios de integración; CI personal 353 casos, 349 aprobados/cuatro omitidos; cero fallos/cancelaciones. Sintaxis y diff correctos. Sin cambios de dependencias ni gates.

## Ensayo Chromium/backend preparado

Se amplía la recuperación de copia de 101 fuentes sintéticas reales ya existentes: context.setOffline(true) después de login real y selección de copia; marcadores de cifras anteriores en DOM (no saldos inventados del servidor); recuperación y repetición locales, raíz/archivo byte a byte y bloqueo de asesoría desde pregunta visible sin POST /consulta. Consulta fallida con evento requestfailed conserva raíz pendiente. setOffline(false), actualización HTTP real de integridad/panel sin reenviar ni confirmar; consulta explícita posterior confirma una vez. Dos intentos explícitos de confirmación: uno fallido de red y uno con respuesta; ningún POST financiero. Pestaña original y snapshots Mongo intactos. No contar el intento fallido como una respuesta del servidor. Resultado del SHA publicado pendiente; registrar runs y evidencias exactas al cierre.

## Límites y liberación

Revisión es coordinación de esta instancia de UI, no bloqueo global, prueba de integridad Mongo o sincronización entre dispositivos. Las lecturas descartadas pueden terminar en el servidor. El cifrado/paquete conserva los límites r75: solo diario manual, no otros diarios ni MongoDB, sin firma externa ni custodia independiente; frase perdida no recuperable, cuota/capacidad y ausencia de CAS multipestaña persisten. No se certifican todas las carreras de todos los módulos ni el funcionamiento desde primera carga offline. No se borran incertidumbres antiguas para habilitar asesoría.

#407 sigue abierto. Custodio independiente real, respaldos completos protegidos/retención/acceso/claves y restauración operacional aislada con RPO/RTO, permisos/índices/credenciales productivos, dispositivos físicos/compatibilidad e informe integral continúan pendientes. Esta prueba de desconexión no sustituye esas evidencias. Sin merge ni Render ni cambios a main/Empresarial/Blushéa/datos reales/costos. No se desactiva gate ni se promete pérdida imposible o recuperación garantizada.

## Siguiente paso recuperable

Verificar HEAD/#389/#407/CI de nuevo. Extender protección/recuperación explícita a otros diarios personales conservando originales y limitando el alcance real de cada paquete. Revisar constancias históricas de paquetes recuperados y conexiones interrumpidas durante confirmación con efectos posteriores. Obtener evidencia externa real de custodia y restauración operativa antes de liberar; no sustituirla por mocks o certificados inventados.
