# Formulario recuperable de ingreso nuevo y recepción V81

## Plan y estado comprobado

Revisión del 5 de noviembre de 2026, hora Colombia. Padre real `f979ab4e641b54aa6098e6089191c0b8a9e23380`, árbol `86e45f90e8d7cfdb8f4de5dca70615c364fea2f1`. PR #389 abierto/no fusionado, integración `integration/fp-hormiga-clasificacion-credito-v81`, base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 abierto. CI del padre: Gate 42133125317, Seguridad 42133125338 y V81 42133125325 success, 70/70 Mongo autorizado. Se revisaron instrucciones/documentación/pendientes antes de modificar.

Un bloque: formulario explícito de alta nueva sobre la API atómica verificada, con revisión de ingresos existentes, persistencia de campos/cuerpo/clave y recuperación. No se inventa dinero desde lo previsto ni se infiere que un movimiento sea duplicado por importe/concepto.

## Comportamiento y criterios de aceptación

- Primero se consulta el calendario y sus ingresos elegibles. Desde esa revisión se elige Registrar ingreso nuevo. La misma instantánea de solo lectura incluye cuentas propias activas COP y señal de lista completa, con límite de 5000. La interfaz valida identidad de calendario/dueño/versión/hash y cuenta, y muestra cantidad/página para no presentar un prefijo como listado completo.
- El formulario distingue la ocurrencia prevista de dinero realmente recibido. Importe y fecha empiezan vacíos; los campos anteriores escritos por el usuario se conservan para recuperar/revisar. No se copia el monto del calendario. Cuenta, concepto, importe entero seguro positivo, categoría, medio y motivo deben seleccionarse/escribirse explícitamente.
- Fecha/hora ingresadas en Colombia se convierten desde UTC-05 a instante UTC canónico; se rechazan fechas civiles imposibles, futuras o a más de 31 días de la ocurrencia. La interpretación no depende de la zona del computador. El formulario no cambia una fecha escrita al cambiar de día.
- Casilla desmarcada exige declarar que se revisó el historial y el ingreso todavía no está registrado; el diálogo explica que suma dinero, muestra importe real/previsto/diferencia exacta, cuenta, fecha Colombia, ocurrencia y motivo. Si ya existe, se usa Vincular este ingreso. Esta revisión humana no equivale a detección automática ni certificación bancaria.
- Cancelar, cambiar de usuario, revisión financiera, consulta, calendario o campos durante confirmación impide enviar. Cuentas mal formadas/incompletas/duplicadas o falla de almacenamiento conservan datos y no habilitan POST. No se permite saltar operaciones inciertas de otro flujo.
- Cuerpo/clave se guardan antes de enviar. Doble clic produce un solo POST. Respuesta perdida después de commit se recupera con GET propio sin registrar ingreso otra vez; mantiene campos y cuerpo originales, y al recargar la casilla vuelve desmarcada. La cuenta se vuelve a elegir/verificar en una lista nueva, sin usar una opción automática.
- El servidor vuelve a validar y confirma o revierte ingreso/saldo/outbox/recepción en una transacción. La lista no reserva la cuenta ni el calendario. Error incierto conserva la solicitud; GET 404 no la descarta. Anular solo el vínculo conserva ingreso y dinero; las correcciones monetarias requieren su compensación explícita.

## Validación del lote

Local Node24: 531 casos del módulo, 522 aprobados/nueve omitidos por servicios externos/cero fallos; 64 dirigidas aprobadas, sintaxis/diff correctos. Casos nuevos incluyen campos vacíos, conversión Colombia, no duplicado, cancelación, importe inválido, cuenta ajena, fechas imposibles/futuras, cambio de revisión/campos/sesión, cuentas duplicadas y almacenamiento fallido. La validación nativa del SHA publicado está pendiente al preparar el lote; no se sustituye por las omisiones locales.

El escenario Mongo autorizado de alta nueva ahora usa botones/campos/casilla/control/API/agenda reales sobre DOM simulado en lugar de crear programáticamente el cuerpo. Comprueba lista propia, ningún monto/fecha prellenado, fecha UTC exacta, doble clic, pérdida de respuesta después de commit, recarga con campos intactos y GET sin segundo POST ni cambios de saldo/ledger/outbox. Mantiene los casos anteriores de rollback, índices, aislamiento, concurrencia y originales.

Mismos índices/roles/colecciones/backup V18 de 38 colecciones. No hay migraciones, provisión, reparación automática, cambios de saldos reales o restauraciones destructivas. HTML/recursos personales juntos `20261105-alta-recepcion-interfaz-v81`. No usar cliente antiguo para la nueva acción: debe recargarse conservando bitácora; la API mantiene sus contratos previos.

## Límites y siguiente paso

DOM simulado no acredita aprobación visual en iPhone/Redmi/PC/Mac ni compatibilidad productiva. El aviso de carga/fecha requiere medición real; no se promete aparición instantánea. Los borradores en sessionStorage por usuario no son backup independiente; el historial/recibo permanecen en el servidor según su persistencia y controles verificados, sin prometer pérdida imposible.

Después de CI exacta: revisar abonos múltiples/recepciones parciales y los flujos financieros/recuperación pendientes según CONTINUIDAD_V81.md; realizar aprobación de interfaz/dispositivos cuando exista evidencia real. Verificar nuevamente HEAD/#389/#407/instrucciones/CI; publicar con expected_sha/force=false, sin sobrescribir trabajo concurrente. Plan/aceptación/evidencia/SHA/siguiente paso quedan versionados en este documento y CONTINUIDAD_V81.md.

#407 sigue pendiente: custodio independiente real, backups completos durables con retención/acceso/claves separados, recuperación operativa/RPO/RTO reales, permisos/índices/históricos de producción, seguridad/aislamiento/exactitud/concurrencia/idempotencia/migración/recuperación, compatibilidad/dispositivos e informe final trazable. Ensayos de fixtures no acreditan recuperación ni custodia productivas. Sin merge a feature/main, despliegue parcial Render, Empresarial/Blushéa, costos nuevos ni datos reales modificados.
