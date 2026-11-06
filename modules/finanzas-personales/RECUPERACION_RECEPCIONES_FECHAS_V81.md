# Recuperación de recepciones entre fechas V81

## Estado, plan y problema reproducido

Revisión del 5 de noviembre de 2026, Colombia. HEAD real antes de actuar: `9ac6d73459ce644ff75f18101b6ba4275e98b711`, árbol `086ab4512fd566122e1454630791fc681cac07d4`. #389 abierto/no fusionado, integration/fp-hormiga-clasificacion-credito-v81 con base feature/finanzas-personales `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 abierto. CI exacta del padre: Gate 42140975861, Seguridad 42140975901, V81 42140975907 success; Mongo autorizado 71/71. Instrucciones y checkpoint versionado revisados; no AGENTS.md adicional encontrado en el árbol.

Un bloque funcional seleccionado: conservar visibles y recuperables los abonos de todas las fechas al corregir fecha, retirar o restaurar calendarios. El bloque previo de abonos está terminado; esta ejecución atiende un fallo distinto de lectura y ciclo de vida.

Reproducción contra el blob del padre: abono activo sin cierre de 100 para 2026-11-08 y vínculo con cierre de 200 para la nueva fecha 2026-11-12. El padre devolvía ocurrenciaRecibida=true y recepcionPendienteCierre=false pese al abono anterior abierto. combinarLegados podía excluir el calendario por la fecha actual cerrada y ocultar la incertidumbre en Home/proyección. No se ha acreditado incidencia sobre datos reales.

## Contrato y aceptación

1. Agrupar todas las recepciones activas por fecha original, sin reasignarlas al corregir fecha prevista. `ocurrenciasPendientesCierre` contiene fecha, total exacto vinculado y cantidad de abonos por cada grupo sin cierre válido. BigInt suma; rango seguro obligatorio. La propiedad es lectura derivada, no una nueva fuente persistida.
2. `recepcionPendienteCierre` es verdadera si cualquier fecha tiene abonos sin cierre, incluso con ocurrencia actual cerrada. combinarLegados conserva ese calendario para que horizonte y proyección fallen cerrado. No infiere restante ni suma previsión al dinero recibido.
3. FINALIZAR_RECEPCION admite referencia exacta de un abono activo de fecha anterior del mismo calendario/usuario, sin cambiar fecha prevista. Mantiene versión, confirmación, motivo y hash de vínculo, revisión de fuente vigente y decisión no aplicada recuperable. No acepta vínculo cerrado, ajeno, inactivo o referencia distinta. Nunca crea ingreso, cuenta ni outbox.
4. Interfaz muestra cada fecha pendiente y monto vinculado, separándolos del total de la fecha prevista actual. Ofrece cierre explícito por fecha; calendario retirado exige restaurar. Comprueba resumen/importe/cantidad contra vínculos antes de mostrar acciones. Fechas anteriores no se cierran por avance de calendario ni por restauración.
5. Retiro/restauración conserva abonos, cierres, fechas y referencia del último retiro incluso si se anula un vínculo durante retiro. Versiones concurrentes producen como máximo un evento efectivo. GET recupera respuesta perdida y conserva solicitud/dueño; replay no duplica evento ni efecto financiero.
6. Originales financieros/eventos anteriores conservados. La lectura y nueva admisión de cierre histórico no alteran hashes ni estados persistidos de eventos ya aceptados. No hay migración, borrado, limpieza, reparación ni escritura en producción. Colecciones/roles/índices/backup no cambian.

## Implementación y validación

Servicios: recepcionCalendarioPersonal deriva grupos pendientes y admite cierre por referencia histórica; calendarioIngresoPersonal conserva pendientes al combinar fuentes. Horizonte/proyección reutilizan sus bloqueos existentes. HTML y scripts personales se versionan juntos `20261105-recepcion-recuperacion-v81`; no se toca el JS ni despliegue de otros productos.

Local Node24: 540 casos, 531 aprobados, nueve omitidos por servicios externos, cero fallos; 62 pruebas dirigidas aprobadas; sintaxis y diff correctos. Los casos cubren cambio de fecha con abono previo y cierre actual, referencias falsas, varios abonos tras retiro/restauración, conservación de históricos, UI de cierre anterior con respuesta perdida/GET y resumen inconsistente rechazado.

Nuevo escenario nativo en `helpers/recuperacionRecepcionesAutorizada.js`: registros reales aislados 200+150, corrección explícita de fecha, anulación de cierre anterior, nuevo ingreso de 50 y bloqueo del horizonte aunque la fecha actual tenga cierre; retiro/anulación/restauración sin caja repetida; restauración y cierre anterior desde UI/control/API con respuesta perdida/GET; previsión nueva solo tras cerrar la incertidumbre; replay, usuario ajeno, originales intactos y dos restauraciones distintas concurrentes. Mongo con autorización y endpoints JWT reales; DOM simulado. CI del nuevo SHA pendiente al preparar el lote; no se cuenta como aprobado antes de ver sus resultados.

## Límites y checkpoint

Cierre es declaración del propietario; no garantiza pagos futuros ni reconstruye dinero perdido. El cierre histórico no acredita saldo bancario. Restituir calendario solo recupera planificación; no registra de nuevo sus ingresos. Un vínculo compensado exige revisión aunque su fecha ya esté cerrada. No se reescriben eventos antiguos para hacerlos cumplir reglas nuevas.

DOM simulado y CI no equivalen a aceptación en dispositivos ni custodia externa. Lentitud/fecha reportadas requieren medición real del servicio publicado; este bloque no afirma corregirlas en producción.

Tras CI exacta: revisar aislamiento y consistencia de deudas/ahorro/conciliación y recuperación de obligaciones vinculadas, siguiendo pendientes versionados. Verificar HEAD/#389/#407/instrucciones/CI antes de retomar; publicar solo con expected_sha y force=false. Conservar aquí y en CONTINUIDAD_V81.md alcance, criterios, SHAs y resultados.

#407 sigue abierto. Faltan evidencia real de custodio independiente, backup durable completo con retención y acceso/credenciales separados, recuperación operativa/RPO/RTO, permisos/índices/históricos de producción y aceptación integral de seguridad/exactitud/concurrencia/idempotencia/migración/aislamiento/recuperación/dispositivos/compatibilidad e informe final. No se levantan gates, se fusiona feature/main ni se despliega Render; sin otros productos, costos o datos reales modificados.
