# Canal privado y diarios al salir — r68

## Partida y plan

HEAD remoto comprobado: f1fddca051e3660557d51b29235ebb56df4e1353, árbol 5b6172b803d329a6c47ecc4e93aad8ebef8d9cd8. #389 abierto sobre feature/finanzas-personales (652126a03f19fbec3c529cad1e84bff11cd3699e); Gate 43146289375, Seguridad 43146289378 y V81 43146289376 verdes. #407 y sus comentarios revisados: permanece abierto. Sin AGENTS.md local. Revisadas instrucciones, README raíz/personal y continuidad; próximo ingreso/compra estricta ya implementados en checkpoints previos, no se repiten como avance.

Un bloque: estado visible del canal durante desconexión y prueba de conservación del diario pendiente al cerrar/cambiar de sesión. El código no atendía disconnect: el estado no indicaba la desconexión decidida por el servidor. Reproducción controlada previa: callback disconnect ausente y tres contratos fallidos. La corrección presenta estado propio, visible en todas las pestañas del módulo, separado de live (mensajes financieros que pueden cambiar al cargar HTTP).

## Comportamiento y aceptación

| Caso | Criterio |
| --- | --- |
| Conexión vigente | Muestra canal conectado, sin afirmar protección total ni saldo actualizado por conectar |
| Servidor desconecta o red cae | Muestra desconectado y alerta; no envía operaciones ni borra solicitudes |
| Rechazo de conexión | Mensaje fijo sin JWT, motivo interno o información privada |
| Reconexión | Estado vuelve a conectado solo para conexión, token y pantalla vigentes |
| Callback antiguo | No altera estado ni carga datos de otra sesión |
| JWT revocado con recuperación pendiente | Servidor desconecta; indicador visible en 390 px y diario conserva clave/cuerpo/estado PENDIENTE |
| Salir y entrar con otra cuenta | Diario del propietario sigue conservado pero no visible para el otro usuario |
| Volver al propietario | Nuevo login HTTP recupera la misma solicitud; consulta de recibo sin POST automático ni efectos adicionales |
| Integridad | Fuentes/caja/capital/eventos financieros iguales antes y después de desconectar/cambiar de sesión; replay conserva contratos |

Pruebas controladas: canalPrivadoFrontend.test.js y socketSesionV81.test.js; ejecutan función connect real con transporte/DOM controlados. Integración: backend-recuperacion.browser.cjs amplía RESTAURACION con JWT revocado en Mongo real, evento Socket.IO, UI y logout/login reales. Se compara diario completo y snapshot financiero; se cuenta POST para demostrar ausencia de reenvío automático. La interfaz conserva llamadas existentes; no cambia autorización HTTP, revocación, ledger ni políticas de suscripción.

## Evidencia inicial

Local: suite personal 623 pruebas, 614 aprobadas, 9 integraciones omitidas por entorno; test:finanzas-personales 338/334/4; cero fallos. Dirigidas canal/socket/dictado: 13/13. Sintaxis JS/harness y git diff --check satisfactorios. Las integraciones reales requieren CI autorizada; no se acreditan por omitirlas localmente. CI del SHA publicado pendiente hasta verificarla. El cambio HTML coloca role=status dentro de app, fuera de pestañas, y actualiza versión del script personal.

## Límites y siguiente paso

No implica logout remoto ni invalida por sí mismo otros JWT: Salir conserva la semántica local existente. Desconexión del canal no equivale necesariamente a fallo de HTTP; el servidor sigue autorizando cada solicitud. No se afirma frescura financiera a partir del socket ni se recuperan paquetes emitidos antes de revocar. El diario probado usa sessionStorage, con continuidad en esa pestaña; no acredita recuperación al cerrarla, pérdida de almacenamiento o dispositivos diferentes. Este recorrido sale después de una respuesta perdida, no durante un POST todavía en vuelo.

Siguiente: reproducir cierre/cambio de sesión mientras un POST financiero está en vuelo y llega su respuesta tarde; verificar conservación de clave/recibo, aislamiento y ausencia de repetición antes de modificar comportamiento. Solo corregir defectos demostrados.

Gates pendientes: #407/custodio independiente real, respaldo independiente protegido/retención y restauración operacional con RPO/RTO medidos, roles/índices/credenciales de producción, revisión independiente y dispositivos físicos/compatibilidad operativa. Este ensayo local aislado no acredita esos controles reales ni certificación externa. Sin merge a feature, sin Render, sin cambios en main/Empresarial/Blushéa, sin datos reales ni servicios/planes nuevos.
