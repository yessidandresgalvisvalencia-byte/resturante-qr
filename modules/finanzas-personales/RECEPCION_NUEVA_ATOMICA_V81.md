# API de ingreso nuevo y recepción atómica V81

## Plan, estado y alcance

Revisión del 5 de noviembre de 2026. Padre real `9f93cfd2021393df54edad7f05d2e70a6d5c23f7`, árbol `796277c59b14161940fc8f1fe49222c476aff7b4`. #389 abierto/no fusionado, integración `integration/fp-hormiga-clasificacion-credito-v81`, base `feature/finanzas-personales` SHA `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 abierto. Gate 42125271069, Seguridad 42125270958 y V81 42125271074 del padre success, Mongo autorizado 69/69. Se revisó documentación/instrucciones/pendientes; no se presupone el antiguo SHA 649ccda3.

Un bloque de API: declarar un ingreso nuevo y cerrar su ocurrencia en una sola transacción. Primero se habilita una sesión externa activa en el registrador financiero existente; sin sesión externa conserva su transacción y publicación postcommit anteriores. La llamada externa nunca abre/cierra/confirma otra sesión ni publica antes del commit; el outbox queda PENDIENTE para el publicador existente del servidor. No hay sesiones anidadas que aparenten atomicidad.

**No incluye todavía el formulario de alta nueva.** La selección de ingresos existentes del lote anterior sigue disponible. La agenda/control/API entienden el nuevo recibo para recuperar solicitudes conservadas; las pruebas crean su petición explícitamente, sin afirmar que exista un botón de alta nueva.

## Contrato y criterios de aceptación

POST existente `/calendario-ingresos/:id/eventos`, identidad JWT/entitlement y limitador existentes. Cuerpo estricto `{solicitudId,solicitud}`. Solicitud `REGISTRAR_RECEPCION`, `confirmacion:true`, versión revisada y motivo; `recepcion:{cerrarOcurrencia:true,cuentaId,montoMinor,fecha,ocurrenciaFecha}`; `datosIngreso:{concepto,categoria,medioPago}`. Fecha UTC canónica con milisegundos no futura, ocurrencia actual, máximo 31 días civiles colombianos; monto entero seguro positivo, cuenta propia activa COP. Categorías admitidas SALARIO/HONORARIOS/VENTAS/OTROS y medios EFECTIVO/TRANSFERENCIA/DEBITO. No acepta propietario, deuda, crédito, fuente sintética, recurrencia ni identidad de movimiento en el cuerpo.

- El servidor deriva ID estable de ingreso mediante SHA256 de propietario/solicitud/producto. La clave financiera lleva HMAC y el índice único existente; la petición completa queda vinculada al evento de calendario. No deduplica por importe/fecha/concepto ni adivina si el ingreso ya existe: debe declararse explícitamente nuevo; si ya fue registrado se usa VINCULAR_RECEPCION.
- Ingreso original, saldo exacto, outbox y evento/vínculo se insertan/ajustan en la misma sesión snapshot/majority. Fallo de evento, outbox, índice, cuenta o resultado incierto no confirma parcialmente. Cuenta seleccionada se verifica por ID antes y después del registrador; una ambigüedad de nombre aborta sin reasignar ni crear caja residual.
- Reintento con misma clave/cuerpo recupera recibo histórico sin registrar dinero otra vez. Misma clave con datos distintos falla. Claves diferentes sobre la misma versión compiten; la perdedora no deja ingreso huérfano ni saldo/outbox adicional. Propietario ajeno no obtiene fuentes ni recibos.
- Recibo `confirmado:true,afectaCaja:true,certificaEstadoActual:false`, ID de movimiento derivado, versión/hash y huella completa. Es evidencia del registro original, no saldo actual ni certificación bancaria. Vincular/anular una fuente existente sigue `afectaCaja:false`. El cliente no confunde ambos contratos y conserva incertidumbres ajenas.
- La respuesta perdida después de commit se resuelve con GET de recibo del propietario, sin segundo POST. Anular el vínculo nuevo conserva ingreso y dinero; corregir/anular dinero requiere su compensación financiera explícita. Una corrección posterior mantiene el original y exige revisión de la recepción; el replay no repone el importe anterior.
- No se guardan decisiones `noAplicada` junto a ingresos nuevos: el error revierte toda la transacción. Una versión superada puede demostrar no aplicación antes del alta. Otros errores inciertos conservan la solicitud y clave; GET 404 no autoriza descartarla.

## Pruebas y evidencia prevista

Local Node24: módulo 526 casos/517 aprobados/nueve omitidos por servicios externos/cero fallos; 59 dirigidas de contrato/recibo/reconstrucción/anulación/sesión/handler/versiones/auditoría aprobadas. Sintaxis y diff correctos. La integración nativa exige CI para el SHA publicado: no hay MongoDB autorizado local ni se cuenta una omisión como aprobación.

Nuevo escenario con rol restringido: cuentas ajenas rechazadas, errores antes/después de insertar evento y al insertar outbox con rollback completo, índice financiero ausente, concurrencia misma clave y claves diferentes, replay/huella, corrección conservando fuente, anulación del vínculo sin revertir caja y GET ante pérdida de respuesta. Usa controlador API y agenda/control reales sobre DOM simulado con petición programática conservada. No desactiva límites ni altera datos reales.

Mismas colecciones, índices, roles, fuentes originales y backup V18/38. No migración ni provisión en producción. Eventos previos conservan hash/contrato. Publicar recursos personales juntos `20261105-recepcion-atomica-v81`; versiones antiguas no entienden la nueva acción y deben fallar cerradas/recargarse, sin borrar su bitácora.

## Bloqueos y siguiente paso

Tras CI exacta: formulario explícito de alta nueva, revisión de duplicados ya registrados y recuperación desde la interfaz; después abonos múltiples y aprobación visual/dispositivos. Revisar HEAD/#389/#407/CI e instrucciones antes de actuar; publicar con expected_sha y force=false. El checkpoint no depende de scratch ni del chat.

#407 sigue abierto: custodio independiente real, backup durable completo/retención/acceso/claves separadas, recuperación operativa/RPO/RTO reales, roles/índices/históricos de producción, aceptación integral de seguridad, exactitud, concurrencia, idempotencia, migración, aislamiento, recuperación, compatibilidad y dispositivos/interfaz e informe final trazable. Ensayo aislado no acredita recuperación productiva ni certificación externa. Carga/fecha requieren medición real pendiente. Sin merge a feature/main ni Render, Empresarial/Blushéa, costos nuevos o datos de producción alterados.


## Primera CI y ajuste de evidencia del escenario

Núcleo `da633f4b16c01475a5014d760cd697b5a5228f48`, árbol `83f79b906bf5b7276be1abf2a9904ed5d2b371e5`; catorce blobs cotejados. Gate 42132492543 y Seguridad 42132492562 success. V81 42132492556 falló en job autorizado 127612292977: al terminar el nuevo escenario se esperaban tres outbox y había cuatro, porque además de tres ingresos existe el evento legítimo de su corrección financiera. Las comprobaciones anteriores de fuente única, rollback y saldo 1300 aprobaron, pero el bloque no se considera verificado hasta repetir CI completa.

Se ajusta la prueba para comparar el número de outbox anterior a la última carrera y exigir exactamente uno adicional. Así se conserva explícitamente el evento compensatorio y se detectan duplicados sin confundir correcciones con ingresos. No se modifica código financiero, controles, cuotas ni gates. Repetir CI del SHA ajustado.

## Evidencia del bloque de API verificado

Código `da633f4b16c01475a5014d760cd697b5a5228f48`; ajuste de prueba `d98956cb6578d7737ada24ebb0be70cf1743897b`, árbol `c53c48602d31817bc780b52a5cfab37a861cad88`, idéntico a la copia probada. Catorce blobs del núcleo y tres del ajuste cotejados; publicación con expected_sha/force=false. El primer intento fallido queda documentado y no se cuenta como aprobación.

CI exacta de `d98956cb6578d7737ada24ebb0be70cf1743897b`:
- [Gate 42132832825](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42132832825): success.
- [Seguridad 42132832845](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42132832845): success.
- [V81 42132832795](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42132832795): success, siete jobs aprobados.

Job Mongo autorizado 127613448394: 70 pruebas/70 aprobadas/cero fallos/cero omisiones. Subtest 22 de alta nueva aprobado: cuenta ajena rechazada, rollback antes/después de insertar evento y por fallo de outbox/índice financiero ausente, misma clave concurrente y claves diferentes, solo un ingreso/saldo/outbox por carrera y ninguna fuente huérfana; compensación conserva fuente, replay no repone el monto anterior, anulación de vínculo conserva dinero. Control/API/agenda reales con DOM simulado y petición programática recuperan por GET una respuesta perdida después de commit sin segundo POST.

Local: 526 casos/517 aprobados/nueve omitidos/cero fallos; 59 dirigidas aprobadas, sintaxis/diff correctos. Node24 local y Node20 en CI. No hay formulario de alta nueva ni aprobación visual/dispositivos en estos resultados.

Ensayo backup V18: 38 colecciones/5396 documentos/3557522 bytes; captura 192 ms, restauración 984 ms, edad 1160 ms; custodiaIndependiente=false y rpoProduccion=false. BSON/índices conservados en destino aislado de fixtures; no acredita custodia real, retención durable ni recuperación operativa/RPO/RTO de producción.

Un bloque de API atómica e integración completo. Este cierre documental requiere CI de su propio SHA y no es otro bloque funcional. Siguiente: formulario explícito de ingreso nuevo con revisión frente a ingresos ya registrados, confirmación y recuperación; después abonos múltiples y aceptación visual/dispositivos. #407 y gates externos reales continúan pendientes. Sin merge a feature/main ni Render, cambios de otros productos, costos o datos reales.
