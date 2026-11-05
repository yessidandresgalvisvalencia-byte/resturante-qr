# Recepción: decisión de no aplicación recuperable V81

## Estado y alcance

Revisión del 5 de noviembre de 2026. Padre verificado `f953c7010534f42e6080e9d51e5cd55f7e8f5c35`, árbol `e88af11bbbfdc75472b66dfb5d57e91a63503fc8`; #389 abierto, base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`. #407 abierto. Gate 42110471817, Seguridad 42110471964 y V81 42110472151 del padre success, integración autorizada 69/69. Rama exclusiva `integration/fp-hormiga-clasificacion-credito-v81`. La publicación de este lote no autoriza merge ni despliegue.

Un bloque: recuperación de una recepción rechazada porque el ingreso ya tiene otro vínculo, la fuente efectiva difiere de lo confirmado o su cuenta propia COP no está disponible. Antes, un 409 genérico podía mantener la solicitud incierta indefinidamente y bloquear su revisión. No basta un GET 404 ni una comparación fallida de la fuente para demostrar que una transacción anterior no terminará aplicando.

## Contrato y criterios de aceptación

- Una decisión `noAplicada=true` se inserta con la misma solicitud, huella completa, propietario y versión, dentro de snapshot/majority. Compite por los mismos índices únicos de calendario, solicitud y orden global del usuario que una aplicación válida. Si gana una aplicación, se devuelve su recibo original; si gana la decisión, esa clave queda definitivamente no aplicada aunque luego coincidan los datos. No se revierte ni se reescribe caja.
- La decisión avanza la versión auditada, conserva anterior=posterior y encadena motivo/hash. Motivos cerrados: INGRESO_OCUPADO, FUENTE_NO_COINCIDE, CUENTA_NO_DISPONIBLE. No se altera el hash de eventos históricos sin esos campos opcionales. Se valida estructura, ocurrencia activa y ausencia de otro vínculo de esa ocurrencia antes de guardar decisión.
- POST devuelve 409 con `RECEPCION_NO_APLICADA`, `decisionPersistida=true`, `noAplicada=true`, `afectaCaja=false` y `certificaEstadoActual=false` solo después de finalizar la transacción/sesión. GET propio devuelve el recibo no aplicado aun tras perder la respuesta. El historial conserva la petición y la decisión originales.
- Agenda y control financiero verifican identidad, ruta, clave, versión, motivo y huella del cuerpo completo. Resuelven únicamente esa operación; mantienen pagos inciertos diferentes. Se conservan campos y cuerpo local, se cierra la revisión antigua y se exige consultar y seleccionar de nuevo antes de otra solicitud. Un acuse alterado o respuesta de sesión anterior conserva el pendiente.
- Errores de infraestructura, integridad, capacidad, índice ausente, relación estructural o resultado transaccional incierto no se convierten en decisión definitiva. Se conserva la recuperación manual con la misma clave. Ningún proceso elimina pendientes ni cambia el ingreso original para desbloquear.

## Validación del lote

Local Node24: 514 casos del módulo, 505 aprobados/nueve omitidos por servicios externos/cero fallos. Cuarenta y tres dirigidas de recepción, interfaz, versiones y auditoría aprobadas; sintaxis y diff correctos. Sin MongoDB/replica set autorizado disponible localmente: la evidencia nativa de este SHA debe obtenerse de CI, sin omitir esa integración ni afirmar su aprobación antes de observarla.

La prueba HTTP/Mongo autorizada existente se amplía: rechazo persistido y replay, dueño ajeno, dos peticiones simultáneas de la misma clave con un único evento, competencia de calendarios, fallo de inserción para éxito y rechazo sin cambios, corrección posterior que ya coincide con una solicitud definitivamente rechazada y aplicación nueva explícita. Incluye agenda/control/API reales sobre DOM simulado: pierde respuesta después de guardar rechazo, recarga, recupera por GET sin otro POST, conserva cuerpo/campos y mantiene incertidumbre de un pago distinto. Compara cuentas, transacciones y outbox sin cambios por decisiones/vínculos.

Campos opcionales en la misma colección protegida; no hay nuevas colecciones, índices, privilegios, migración ni cambio de alcance de backup V18 (38 colecciones). Actualizar HTML y recursos personales versionados juntos (`20261105-recepcion-decision-v81`). Recursos sin actualizar deben recargarse; no se considera aprobación de dispositivos reales.

## Límites, bloqueos y siguiente paso

Este bloque prepara recuperación: **no entrega todavía selector/formulario de ingreso existente ni alta nueva atómica de ingreso+recepción**. Próximo: consulta de ingresos elegibles y formulario de vínculo/anulación con confirmación explícita, revisión de datos y recuperación ahora disponible; después alta atómica sin anidar sesiones del registrador general. Revisar HEAD/#389/#407/CI y esta documentación antes de actuar; publicar con expected_sha/force=false, sin sobrescribir trabajo concurrente.

#407 sigue pendiente: custodio independiente real, respaldo durable completo con retención/acceso/claves independientes, ensayo operativo de restauración y RPO/RTO reales, roles/índices/históricos de producción, aceptación integral de seguridad, aislamiento, exactitud, concurrencia, migración y recuperación; interfaz/dispositivos, compatibilidad e informe final trazable. Los ensayos sintéticos no acreditan custodia ni recuperación productiva. La queja de carga/fecha requiere medición real pendiente. No hay cambios de producción, restauraciones destructivas, aumento de costos, merge a feature/main, cambios de otros productos ni despliegue Render.
