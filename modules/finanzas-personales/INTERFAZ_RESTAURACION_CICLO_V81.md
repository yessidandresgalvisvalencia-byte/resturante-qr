# Recuperación de pagos con ciclo revisado — r62

## Alcance y plan

Base verificada: feature/finanzas-personales, SHA 652126a03f19fbec3c529cad1e84bff11cd3699e. PR #389 abierto, no fusionado; integración integration/fp-hormiga-clasificacion-credito-v81. Padre real 7e89a42632d3784a9f3039893a529e8ed919b7cd, árbol 052b5875ec6d71db1dc21b72180dc0e14b258cd2. #407 continúa abierto. CI del padre: Gate 42220250925, Seguridad 42220250927, V81 42220250938, todos satisfactorios.

Un bloque funcional: conectar el historial de pagos anulados a la revisión y confirmación financiera, conservar solicitud por propietario antes de enviar, consultar recibo tras incertidumbre y permitir únicamente reenvío explícito con cuerpo/clave originales. No modifica la recuperación ordinaria ni amplía las condiciones que admite la API. El servidor sigue verificando firma, propietario, capital, secuencia, fondos y transacción atómica.

## Criterios de aceptación y evidencia

- Historial: botón independiente en PAGO_DEUDA anulado recuperable; usa préstamo, movimiento y anulación originales. La restauración ordinaria conserva su bloqueo ante cambio de fecha.
- Revisión de solo lectura: compara fechas en Colombia, cuota y periodicidad original/actual; muestra capital, pago real, débito y cuenta. Aplicar/excluir tiene efecto distinto en reserva de cuota, ambos restauran el mismo pago. No recalcula intereses ni promete disponibilidad.
- Confirmación explícita: requiere tratamiento y motivo; muestra pago, capital, débito y ciclos. Cambio de formulario, sesión, selección o revisión financiera invalida la confirmación.
- Diario por usuario en sessionStorage: conserva cuerpo y clave antes del POST, mantiene solicitudes y recibos sin limpieza automática. Si falla almacenamiento o su estructura no es verificable, no crea otra solicitud. Límite 100: falla cerrado, no elimina entradas para liberar espacio.
- Respuesta perdida: la petición queda pendiente. Primero GET del recibo; 404 no prueba ausencia de aplicación. Reenvío manual exige confirmación y conserva exactamente cuerpo y clave. Otros fallos del GET impiden reenviar. Recibo ajeno, genérico o desvinculado no confirma la operación.
- Sesión y concurrencia: doble clic no duplica; respuestas tardías no dibujan datos de otra sesión/selección. Control financiero mantiene incertidumbre hasta validar recibo; después se solicitan saldos nuevos, el recibo no certifica estado actual.
- Integración: nuevo módulo de texto DOM, panel accesible con labels/status, limpieza de vista y entrada de sesión en aplicación; versiones coherentes de scripts y gate de carga. HTML anterior sin panel no rompe el módulo.

Pruebas DOM: test/finanzas-personales/recuperacionInterfaz.test.js y helpers/recuperacionInterfazFixture.js. Ensayo real autorizado: helpers/restauracionCicloPagoAutorizada.js conserva sus verificaciones de capital, fuente, reserva y caja; la segunda restauración EXCLUIR pasa ahora por interfaz/handler/servicios, simula respuesta perdida después del commit, recarga diario y recupera recibo por GET. Exige un solo POST e igualdad completa de la foto Mongo tras consultar el recibo. APLICAR concurrente, rollback, firma corrupta y fondos insuficientes permanecen cubiertos en ese ensayo.

## Validación local y límites

Diez pruebas dirigidas satisfactorias. Módulo: 605 casos, 596 aprobados, 9 omitidos por requisitos de integración; cero fallos. La prueba Mongo autorizada no se afirma ejecutada localmente: requiere CI del SHA publicado. CI personal: 338 casos, 334 aprobados, 4 omitidos, cero fallos. Tres pruebas de versión/carga aprobadas. npm run check:syntax, node --check de nuevos módulos/fixtures y git diff --check satisfactorios. CI exacta publicada pendiente.

No hay evidencia visual de navegador/dispositivos reales en este lote; las pruebas DOM verifican comportamiento, no aprobación visual. Diario de pestaña no es respaldo independiente ni persiste si el usuario borra/cierra su almacenamiento. Solicitudes rechazadas sin recibo siguen conservadas; no se declara ausencia de aplicación por códigos HTTP.

## Bloqueos y siguiente paso recuperable

#407 impide liberación mientras falte verificación independiente real y evidencia operativa completa: custodio independiente cuando corresponda, roles Mongo reales que impidan UPDATE/DELETE de historial, índices, credenciales administrativas separadas, respaldo independiente protegido/retención/acceso, restauración aislada con RPO/RTO medidos y aceptación completa de seguridad/exactitud/concurrencia/idempotencia/migración/aislamiento/recuperación/interfaz/dispositivos. La evidencia sintética no sustituye estos controles. No se acreditan certificación externa ni garantías absolutas.

Tras CI exacta verde: revisar resolución comprobable de solicitudes de restauración rechazadas por contexto cambiado sin emitir nuevos débitos ni borrar solicitudes; completar aceptación visual y operativa solo con evidencias reales disponibles. Mantener documentación/plan y #407 abiertos. No fusionar a feature ni desplegar en Render hasta cumplir todos los criterios. Main, Empresarial y Blushéa no se modifican; ningún dato real ni servicio/costo se altera.
