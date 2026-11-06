# Recepción de ocurrencias vinculada al ledger — API V81

2026-11-05, Colombia. Padre confirmado `1386995ce9dedab01365ff9854c187223ab7c31d`, árbol remoto/local idéntico `e2a6c7271e02330b3f44065fbcc48e811a23ed40`. #389 abierto sobre feature/finanzas-personales (`652126a03f19fbec3c529cad1e84bff11cd3699e`), #407 abierto. CI del padre: Gate 42098366515, Seguridad 42098366522 y V81 42098366622 success.

## Resultado y alcance

Una ocurrencia de calendario gestionado puede conciliarse con un ingreso que ya existe en el ledger personal. El propietario confirma identidad de movimiento, cuenta, importe e instante real, fecha prevista y cierre de ocurrencia. El vínculo es un evento append-only del calendario; no registra otra entrada de dinero. La anulación del vínculo y una vinculación posterior explícita también conservan el historial. Cuentas, transacciones y outbox quedan intactos por estas operaciones.

Esta etapa entrega API y lecturas de Home/proyección. El registro general de un ingreso abre su propia transacción; no se encadena desde este servicio para simular atomicidad de dos transacciones. Crear un ingreso nuevo junto con su recepción requiere otro flujo que escriba todo en una misma transacción, pendiente. Tampoco se entrega todavía el formulario para iniciar estos vínculos o una conciliación de varios abonos por ocurrencia.

## Contrato estricto

Se usa POST /calendario-ingresos/:id/eventos, con la autenticación, entitlement, rate limit y no-store existentes. Cuerpo exacto: solicitudId estable y solicitud con accion, confirmacion true, versionEsperada y motivo de 8–240 caracteres.

- VINCULAR_RECEPCION añade recepcion con movimientoId, cuentaId, montoMinor positivo entero seguro, fecha ISO UTC canónica del movimiento, ocurrenciaFecha civil YYYY-MM-DD y cerrarOcurrencia true. Los demás campos son rechazados. La ocurrencia debe ser la fecha prevista del calendario activo. El instante real no puede ser futuro; la distancia entre día real colombiano y fecha prevista no excede 31 días.
- DESVINCULAR_RECEPCION añade recepcionReferencia con ocurrenciaFecha, versionVinculo y vinculoHash exactos del evento inicial. Se verifica toda la cadena y la referencia previa activa. Anular el vínculo no anula el ingreso financiero ni activa un calendario retirado.
- GET del listado/historial conserva recepciones, estado actual derivado y referencias. GET /calendario-ingresos/recibos/:clave recupera el recibo original vinculado a cuerpo/usuario/calendario/versión. Mismo cuerpo/clave devuelve el mismo recibo; otro cuerpo con la clave se rechaza. CertificaEstadoActual sigue siendo false y afectaCaja false.

Un mismo movimiento solo puede ocupar un vínculo activo entre todos los calendarios de su propietario; una ocurrencia admite un vínculo activo. Las claves únicas de solicitud, secuencia por calendario y orden global por usuario se exigen antes de leer/escribir. La transacción snapshot/majority y el orden global único serializan carreras entre calendarios distintos. Una anulación explícita libera el vínculo activo para corregir la conciliación; los eventos anteriores nunca se actualizan ni borran. Repetir una solicitud antigua recupera su recibo histórico, no restaura automáticamente su estado.

## Evidencia financiera y proyección

La fuente se verifica en la vista efectiva del ledger compensado completo y acotado del usuario, no en filas sintéticas de deltas de caja. Debe ser INGRESO ACTIVA, COP, impactoCaja true, no recurrente ni movimiento sintético, con cuenta/importe/instante exactamente revisados; no se acepta COBRO_PRESTAMO, PRESTAMO_RECIBIDO o pago con crédito como ingreso recibido. La cuenta propia debe estar activa en COP al vincular. El registro es una declaración registrada en el ledger; no constituye confirmación independiente del banco.

El evento conserva monto previsto al vincular y monto real; diferenciaPrevistoMinor se calcula con BigInt y conversión segura. CerrarOcurrencia true confirma explícitamente cerrar la previsión aun cuando difiera del ingreso real: no se inventa que el faltante llegará. No hay reparto automático ni suma de abonos. La fecha prevista original y sourceId no se reescriben.

Home y proyección leen el ledger efectivo y eventos de calendario en el mismo snapshot. Una ocurrencia verificada se excluye de ingresos futuros, sin descontar o sumar caja otra vez. No se programa automáticamente el mes siguiente. El propietario debe confirmar la siguiente fecha mediante corrección explícita del calendario. Si no hay otra previsión futura, Disponible Hoy sigue por confirmar según sus gates existentes.

Una compensación posterior que cambie monto, tipo, vigencia u otros hechos revisados genera REQUIERE_REVISION. Home conserva saldos/flujo efectivos pero bloquea la autorización basada en ese horizonte; la proyección falla explícitamente. El listado/historial siguen accesibles para revisar/anular el vínculo. Después se puede vincular el estado corregido con otra petición, conservando los dos hechos históricos. No hay reparación automática ni reverso de caja por anular solo el vínculo.

Se reutiliza la lectura efectiva dentro del callback de la misma transacción; no hay caché global de saldos o de otra sesión. La evaluación usa un mapa por ID y conserva los límites existentes de 5000 movimientos, 10000 compensaciones, 5000 eventos de calendario/1000 por calendario. Un fallo de integridad, capacidad, índice o lectura no genera una previsión parcial confiable.

## Matriz de aceptación

| Caso | Prueba preparada |
| --- | --- |
| Datos estrictos | Coerciones, campos ajenos, fecha sin instante, cierre no confirmado, futuro, ocurrencia distinta o lejana rechazados |
| Ingreso real revisado | Tipo/cuenta/importe/instante/propietario/vigencia/impacto de caja exactos; fuentes recurrentes o sintéticas rechazadas |
| Conservación | Originales y eventos previos sin cambios; snapshots de cuenta/transacciones/outbox antes y después del vínculo y anulación |
| Concurrencia | Dos calendarios/claves compiten por el mismo ingreso: un vínculo; replay simultáneo recupera el mismo resultado |
| Fallo atómico | Error al insertar evento deja todo el lote sin efecto; índice de orden ausente bloquea sin fallback |
| Corrección posterior | Fuente original permanece íntegra; compensación cambia vista efectiva, marca revisión y bloquea asesoría/proyección hasta conciliación explícita |
| Recuperación | GET del recibo propio, 404 ajeno, clave con otro cuerpo rechazada; anulación por hash/version y revinculación con estado corregido |
| Previsión | Una ocurrencia consumida no se cuenta otra vez; cierre no inventa fecha siguiente ni ingreso adicional; se conservan diferencias |
| Interfaz de lectura | Distingue ocurrencia vinculada de recepción que requiere revisión; formulario de vínculo pendiente |

Pruebas nuevas: recepcionCalendario.test.js y helpers/recepcionCalendarioAutorizada.js conectado al job Mongo autorizado; calendarioInterfaz.test.js amplía lectura de estado. No se agregan colecciones, índices o permisos: las veinte colecciones protegidas y backup V18 de 38 colecciones conservan alcance. Estado/solicitud usan campos Mixed existentes; los hashes de eventos antiguos sin recepción mantienen su contenido. Los nuevos eventos requieren este lector: comprobar compatibilidad/rollback antes del despliegue final.

Local Node24: 510 casos/501 aprobados/nueve omitidos/cero fallos; 37 dirigidas de Home/versiones/privilegios/respaldo aprobadas. Sintaxis general y nuevas fuentes/helpers correctos; diff y auditoría estática sin estos patrones de mutación, manteniendo bloqueo independiente de #407. CI Node20/Mongo autorizado del SHA publicado pendiente antes de contar el bloque completo. No hubo Mongo local ni prueba con datos reales.

## Siguiente lote y liberación

1. Interfaz de selección de ingreso existente: cuenta, importe/instante, fecha prevista y diferencia visibles; confirmación de cierre, solicitud conservada y recibo recuperable; anular/revincular mediante referencia sin mover caja.
2. Diseñar e implementar alta nueva de ingreso y vínculo en una sola transacción con idempotencia, rollback y concurrencia. No usar dos commits de dinero ni dar por completa esta etapa con el vínculo a una fuente existente.
3. Abonos parciales/múltiples, aceptación visual/dispositivos y archivo/exportación de pendientes sin borrar evidencia; medir demora/fecha productivas con evidencia real.

#407, custodio independiente real, copia completa durable/retención/acceso/claves separados, recuperación operativa aislada y RPO/RTO productivos, roles/índices/históricos reales, seguridad/compatibilidad/informe final siguen pendientes. Sin merge a feature ni Render, main/Empresarial/Blushéa, costos nuevos, migraciones o alteración/restauración de información real.

## Evidencia del núcleo publicado

Núcleo `e1c8e7a293b91adeb7d2ab835f9c6b0686e680b1`, árbol `644d672f087befbc904815fad8ba221833737da1`. Gate 42109979018, Seguridad 42109979073 y V81 42109979308: success para ese SHA. Job Mongo autorizado 127534662131: 69 pruebas/69 aprobadas/cero fallos; aprobó el subtest de recepción única por ocurrencia. Demostró fuente financiera original intacta, competición entre calendarios, replay, error de inserción, lectura compensada corregida, horizonte en revisión, referencia de anulación y revinculación, sin escrituras de caja por el vínculo. Catorce blobs remotos cotejados y árbol idéntico a la copia probada.

Local final: Node24, 510 casos/501 aprobados/nueve omitidos/cero fallos; 37 dirigidas aprobadas; sintaxis y diff correctos. CI Node20 confirmó el comportamiento. El cierre documental descendiente requiere su propia CI y no es otro bloque funcional.

Ensayo V18: 38 colecciones/5364 documentos/3505218 bytes, captura 202 ms, restauración 906 ms, edad 1074 ms; custodiaIndependiente=false y rpoProduccion=false. Conservación BSON/índices en base aislada, sin recuperación productiva ni certificación externa. Alcance/roles/índices del backup sin cambios.

Un bloque de API de conciliación de recepción con ingreso existente e integración verificado. Pendientes: interfaz de vínculo y recuperación; alta nueva de ingreso+recepción en una única transacción; abonos múltiples; aprobación visual/dispositivos y todos los gates externos de #407. Sin merge a feature ni Render, datos reales o costos alterados.
