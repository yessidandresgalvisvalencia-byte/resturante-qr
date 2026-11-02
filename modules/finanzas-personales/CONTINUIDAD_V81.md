# Continuidad y aceptación de Finanzas Personales V81

## Checkpoint del 1 de noviembre de 2026

- Repositorio: `yessidandresgalvisvalencia-byte/resturante-qr`.
- Base autorizada: `feature/finanzas-personales`, observada en `f44a0535ad86ac7f10a90be6a700cfc8618a43e0`.
- Integración: `integration/fp-hormiga-clasificacion-credito-v81`, PR #389 abierto.
- HEAD verificado antes del lote: `649ccda3f234bf0ab540113db8f01380819a77b2`; sus tres workflows terminaron en success.
- #407 sigue abierto. Mantener sin fusión ni despliegue. No modificar main, Empresarial ni Blushéa.
- Implementación publicada con lease: `b1c2eb2a4ca9e04caf8be2990d90e4bebc42d4a0`. La revisión de dependencias posterior se identifica mediante el historial de este archivo; validar siempre el HEAD remoto exacto.

## Bloque: evaluación de compras con evidencia suficiente

Problema reproducido sobre el HEAD anterior: una fecha inválida y `aptoParaDisponibleHoy: "true"` permitían estado `CABE`, con `FECHA_NO_VERIFICADA` en la consecuencia. Una advertencia no impedía la aprobación monetaria.

Criterios implementados y pruebas:

| Criterio | Comportamiento y evidencia |
| --- | --- |
| Conciliación explícita | Exige aptitud, saldo conocido y próximo ingreso conocido como booleanos true, confiabilidad VERIFICADO y reconciliación false; disponible entero no negativo |
| Próximo ingreso válido | Requiere importe entero seguro positivo y fecha futura en el calendario colombiano; hoy, vencida o inválida devuelve FALTAN_DATOS sin cifras parciales |
| Fechas sin coerción | Date válido o ISO con zona explícita; YYYY-MM-DD se interpreta en Bogotá. Rechaza números, booleanos, arrays, fechas imposibles y horas sin zona |
| Cálculo y mensajes | Conserva CABE, NO_CABE, REQUIERE_PLAN, restante exacto y costo conocido del crédito; referencia diaria sin prometer suficiencia |
| Integración y propiedad | Ruta conserva identidad autenticada; mismo instante de evaluación para home, consecuencia y alerta. Prueba de MongoDB con rol restringido usa home real, aislamiento y comparación de fuentes antes/después |
| Fallos seguros | Input inválido falla antes de leer; fallo 422 de home se propaga sin autorizar. No escribe operaciones |

Validación local: 17 pruebas seleccionadas aprobadas; suite `test/finanzas-personales/*.test.js`: 204 aprobadas y nueve omitidas por servicios externos. `npm run gate` pasó sintaxis pero terminó con 64 fallos por ausencia de MongoDB local (TEST_MONGO_URI), 667 aprobadas y siete omitidas: no se presenta como gate aprobado. Runtime local Node 24; CI usa Node 20. La integración autenticada nueva queda sujeta a CI, sin atribuirle una ejecución local inexistente.

Comandos reproducibles:

```bash
node --test test/gruk/gasto-preventivo-consecuencias-diarias.test.js test/gruk/gasto-alerta-vencimiento-proximo.test.js test/gruk/simulador-compra-api-ui-contrato.test.js
node --test test/finanzas-personales/*.test.js
npm run gate
```

La prueba autenticada está incluida en `privilegiosLedgerMongoV81.integration.test.js`, ejecutada por el job `mongo-privileges-v81`. Exige instancia efímera aislada con autorización en loopback; no usar credenciales ni datos de producción. Los cambios de calendario y cuenta del ensayo solo afectan IDs aleatorios nuevos. No se borran ni reescriben fuentes financieras.

Evidencia remota de `b1c2eb2a4ca9e04caf8be2990d90e4bebc42d4a0`: [GRUK Gate 41390904254](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41390904254) aprobó. En [V81 41390904245](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41390904245), el job autenticado `125101852014` aprobó 25 pruebas, cero omisiones, incluido el nuevo caso de compras con home real. Los demás ensayos funcionales también aprobaron; V81 y Seguridad fallaron únicamente por dos vulnerabilidades de dependencias. No describir ese SHA como CI completamente verde.

## Bloque: remediación de dependencias detectadas por CI

La auditoría del lote identificó `joi@18.3.0` ([GHSA-4528-x5fx-h6hg](https://github.com/advisories/GHSA-4528-x5fx-h6hg)) y `follow-redirects@1.16.1` ([GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)), ambas de severidad alta. Joi valida las rutas personales y follow-redirects llega mediante axios; también son dependencias compartidas, por lo que requieren el gate completo antes de cualquier integración.

Se actualizaron únicamente esas dos resoluciones de `package-lock.json` a `18.3.1` y `1.16.2`, respectivamente: seis líneas sustituidas, con integridad y URL npm, sin modificar los rangos del manifiesto. `npm ci --ignore-scripts` y `npm audit --omit=dev --audit-level=low` terminaron con cero vulnerabilidades informadas. No se usó force ni se desactivó ningún gate. La ausencia de alertas conocidas en ese momento no constituye auditoría independiente.

El SHA de código y lockfile `f63c35a46e622aaf6738003cb89143a5a6b09e9b`, publicado con lease sobre `b1c2eb2a4ca9e04caf8be2990d90e4bebc42d4a0`, completó las tres validaciones remotas:

- [GRUK Gate 41391138563](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41391138563): success, gate completo con MongoDB.
- [Seguridad y Pruebas 41391138565](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41391138565): success, auditorías y pruebas financieras/concurrencia.
- [Precisión e Integridad 41391138605](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41391138605): sus siete jobs terminaron en success, incluyendo auditoría de producción e integración con rol MongoDB restringido (`125102571034`).

Este checkpoint posterior solo documenta esa evidencia; distinguir el SHA de código probado del commit documental que lo registra. Antes de continuar, consultar el HEAD remoto y CI de ese HEAD. No desplegar ni fusionar hasta satisfacer también los pendientes externos enumerados abajo. No hubo cambio de configuración ni despliegue de Render durante este lote.

## Plan prioritario pendiente y aceptación final

1. Confirmar CI del SHA publicado, incluyendo nuevo caso autenticado; si falla, corregir sobre HEAD actualizado con lease, sin eludir gates.
2. El bloqueo por obligaciones sin fecha está implementado en el lote del 2 de noviembre descrito abajo. Continúan pendientes la revisión de recurrencias y consistencia de las lecturas de home; el panel todavía no es una instantánea global. La evaluación es una observación, no reserva fondos ni confirma saldo bancario.
3. Completar recuperación accesible: inventariar anulaciones y reversiones existentes, definir restauración explícita del propietario con confirmación, eventos append-only, transacción e idempotencia; demostrar que restaurar no duplica caja, pagos ni reservas. No declarar este requisito completo con las anulaciones existentes.
4. Preparar y probar backup independiente: custodio y destino autorizados, retención, cifrado y acceso separado, métricas RPO/RTO medidas y restauración en entorno aislado; evidencia real pendiente. No contratar servicios, borrar históricos ni sobrescribir producción.
5. Resolver #407 según la matriz de `docs/finanzas-personales/liberacion-segura-hormiga-v81.md`: privilegios reales de cinco colecciones, custodia independiente real sin retrocesos, cobertura de escrituras, históricos, índices y compatibilidad operativa. Los ensayos de CI no acreditan permisos de producción ni auditoría independiente.
6. Antes del despliegue final: requisitos completos, pruebas de seguridad/exactitud/concurrencia/idempotencia/migración/aislamiento/recuperación y dispositivos reales, CI verde del SHA exacto, costos y capacidad autorizados. Solo entonces integrar a feature y verificar servicio personal Render, SHA live, salud, persistencia, índices y permisos. No hay certificación externa ni garantía de pérdida imposible.

Siguiente paso concreto: validar el HEAD remoto y continuar con recuperación explícita del propietario y revisión de recurrencias; conservar el bloqueo de producción mientras faltan custodia, recuperación y evidencia operativa.

## Checkpoint del 2 de noviembre de 2026 — obligaciones sin fecha

Partida comprobada: PR #389 abierto, base `feature/finanzas-personales` en `f44a0535ad86ac7f10a90be6a700cfc8618a43e0`, integración en `1bb7ab35a43253674e72339f7fbb960d5345d2ae`. Las tres validaciones de ese SHA están en success: [Gate](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41391268945), [Seguridad](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41391268941) y [V81](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41391268966). #407 permanece abierto. Trabajo aislado sobre ese commit; publicar con lease para detectar cambios concurrentes.

Problema reproducido contra la versión anterior del servicio: un préstamo activo con saldo positivo y vencimiento null y una tarjeta histórica con saldo y día de pago null devolvían `aptoParaDisponibleHoy: true`. La lista parcial de compromisos podía presentarse como suficiente aunque faltara una fecha.

| Aceptación de este bloque | Implementación y evidencia |
| --- | --- |
| No autorizar con vencimientos desconocidos | Préstamos POR_PAGAR ACTIVO/VENCIDO con saldo positivo y fecha ausente/inválida generan `asesor.obligacionesSinFecha`; disponible e importe GMF pasan a null, y la decisión exige conciliación |
| No inventar fecha de tarjeta | Tarjetas activas con saldo requieren día entero de 1 a 31; si falta, no se construye un vencimiento con Date y se bloquea el disponible |
| Explicación visible | Decisión `CONFIRMAR_FECHA_PAGO`, con monto null y explicación de confirmar fecha; usa el renderizador existente del panel |
| Casos válidos | Deuda fechada conserva cuota pendiente y cálculo exacto; saldo cero, PAGADO, CANCELADO y POR_COBRAR no agregan bloqueo sin fecha |
| Aislamiento y preservación | Integración de rol restringido con home y evaluador reales, deuda ajena, comparación de cuentas/préstamos/tarjetas/transacciones/outbox antes y después de las lecturas |
| Fallos | Tipos de fecha coercibles y días inválidos no pasan como calendario; fallo de consulta se propaga sin cifras parciales |

Validación local: 128 pruebas seleccionadas aprobadas, cero omisiones. Suite V81: 204 aprobadas y nueve omitidas por necesitar servicios externos; no acredita una integración local. Los dos casos de autorización incorrecta fallan al ejecutar las regresiones contra el código anterior y aprueban con la corrección. La nueva prueba autenticada se incluye en `privilegiosLedgerMongoV81.integration.test.js`; CI del SHA publicado debe probarla sin omisiones. No hay MongoDB local en este entorno.

```bash
node --test test/gruk/home-obligaciones-sin-fecha.test.js test/gruk/finanzas-personales-core.test.js test/gruk/homeCajaMasterRegression.test.js test/gruk/gasto-preventivo-consecuencias-diarias.test.js test/gruk/gasto-alerta-vencimiento-proximo.test.js
node --test test/finanzas-personales/*.test.js
```

La integración crea exclusivamente datos ficticios de IDs aleatorios en el replica set local de CI. Para simular la tarjeta histórica incompleta inserta un documento mediante el driver nativo en la colección mutable de deudas del ensayo; no modifica fuentes append-only. Confirmar fechas en el ensayo solo modifica esos registros mutables ficticios. Las lecturas no realizan reparaciones ni borrados.

Revisión de recurrencias: el aplicador compensatorio actual rechaza fuentes `recurrente: true`; los abonos vinculados sí admiten anulación y el cálculo de pagos de hoy ya usa `consultarPeriodo` compensado. Esto explica por qué no se cambió la consulta de las fuentes recurrentes en este lote; no demuestra cobertura completa, ni implementa restauración de fuentes recurrentes.

Próxima implementación prioritaria: inventariar la anulación vigente, su estado compensado, reservas y delta de caja para diseñar restauración explícita idempotente accesible al propietario. No habilitar restauración cambiando documentos originales ni eludiendo la verificación de cadena. Siguen pendientes backup independiente, retención, RPO/RTO medidos, custodia real, permisos/índices de producción y dispositivos. No fusionar ni desplegar.

### Evidencia del lote publicado

Código publicado con lease: `22c68ab8bbc1a185fc5865eedc0c2ba28fe8227b`. Las tres validaciones del SHA exacto aprobaron:

- [GRUK Gate 41395668033](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41395668033): success.
- [Seguridad y Pruebas 41395668018](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41395668018): success.
- [Precisión e Integridad 41395668017](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41395668017): siete jobs en success, incluido `mongo-privileges-v81` (`125116337055`). La prueba de obligaciones sin fecha ejecutó home y evaluación de compras reales con el rol restringido.

Este registro posterior es solo documental. Consultar HEAD y CI del commit documental antes de continuar; no confundir el código probado con una publicación en Render. #407 permanece abierto y no se cambió producción.

## Checkpoint del 2 de noviembre de 2026 — recuperación de caja simple

HEAD de partida verificado: `63e26d46043a0a898b583dce556ad4a7c7be1ae8`; PR #389 y #407 continúan abiertos. CI de partida: [Gate](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41395810295), [Seguridad](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41395810319) y [V81](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41395810198), todos success. Se trabaja en checkout aislado y se publica con HEAD esperado, sin modificar main ni desplegar.

### Alcance y aceptación del bloque

La recuperación cubre exclusivamente ingresos y gastos de caja simple, con cuenta propia COP activa, sin préstamo, crédito, recurrencia ni abono recurrente vinculado. No recupera documentos físicamente eliminados, fuentes legacy marcadas ANULADA sin evento, cuotas ni deudas. Es un primer flujo de recuperación; el requisito global de recuperación y backup independiente sigue pendiente.

| Criterio | Comportamiento y verificación |
| --- | --- |
| Preservar fuentes | Nuevo evento RESTAURACION V5, sin UPDATE/DELETE de fuente ni de eventos; conserva correcciones previas y la anulación |
| Restaurar la operación exacta | Firma `anulacionHash` del evento anulado vigente; no acepta referencias anteriores, restauración sin anulación ni doble restauración con otra clave |
| Caja e idempotencia | Evento, cursor CAS, saldo y outbox dentro de transacción; clave estable por anulación. Un reintento devuelve recibo sin repetir efectos, incluso si después hubo otra anulación |
| Fallos seguros | Rechaza usuario ajeno, cuenta no disponible, importe fuera de rango o saldo insuficiente; el fallo de outbox revierte evento, cursor y saldo |
| Lecturas coherentes | Estado compensado, historial y proyección de caja incluyen la restauración; no se reubica el ajuste de caja en la fecha del movimiento original |
| Confirmación del propietario | POST /transacciones/:id/restaurar exige JWT personal, Idempotency-Key, confirmar true booleano y anulacionHash. Ignora identidad del cuerpo. Devuelve recibo y requiereActualizar, sin afirmar que un recibo histórico sea el estado actual |
| Interfaz | Buscar Estado → Movimientos anulados muestra Restaurar solo en caja simple recuperable. Confirmación explícita, doble clic bloqueado, clave conservada ante error de red y callbacks de sesión anterior descartados |
| Integración | Nuevo evento de outbox, realtime y neurona de flujo; versión JS 20261102-restauracion-caja-v81 |

Validación local: sintaxis aprobada; suite V81 y pruebas de evento, estado, registrador y consulta compensada ejecutadas sin fallos. Las integraciones que necesitan servicios externos se omiten localmente y deben aprobar en CI. `restauracionCajaAutorizada.js` se ejecuta en el fixture autenticado de CI: fuente corregida/anulada/restaurada, reconstrucción de caja, repetición concurrente, carreras con distintas claves, referencia vieja, usuario ajeno, rollback de outbox, saldo insuficiente y restauración de ingreso. Compara fuentes originales y registros antes/después. No utiliza producción.

```bash
node --test test/finanzas-personales/*.test.js test/gruk/restauracion-compensada-personal.test.js test/gruk/evento-compensatorio-personal.test.js test/gruk/estado-compensado-personal.test.js test/gruk/registrador-compensacion-personal.test.js test/gruk/consulta-compensada-personal.test.js
npm run check:syntax
```

### Compatibilidad y límites de liberación

Los payloads/hash V1–V4 no cambian: anulacionHash solo aparece en RESTAURACION V5. No hay migración ni reparación de datos. Un lector antiguo que no admite V5 fallará cerrado después de la primera restauración: no es seguro retroceder el código a esa versión sin un plan probado. Antes de liberar se debe validar la compatibilidad de todos los lectores y el procedimiento de reversión operativa, además de los gates externos existentes. La cadena local no es custodia independiente.

No se ha probado voz ni interfaz en dispositivos reales; la interfaz se verifica con DOM simulado. No se certifica backup, retención, RPO/RTO, custodia externa ni permisos de producción. Sigue prohibido desplegar o cerrar #407 con esta evidencia parcial.

Siguiente paso: confirmar CI del SHA publicado y ampliar recuperación de abonos recurrentes mediante reserva y transacción, sin habilitarla para cuotas/préstamos hasta verificar sus propios efectos. Preparar el ejercicio de backup/restauración aislado y obtener el custodio independiente real siguen siendo pendientes separados.

### Evidencia de recuperación y ajuste de contratos de caché

Implementación publicada con lease: `f2b7b46519d812b4906283698ba9fdeaa7f32051`. [V81 41403091474](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41403091474) y [Seguridad 41403091491](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41403091491) aprobaron. El job autenticado `125138991893` ejecutó 27 pruebas sin fallos ni omisiones, incluida recuperación de caja con reintentos, concurrencia, aislamiento, preservación de fuentes, saldo insuficiente y rollback. Validación local ampliada: 247 aprobadas y nueve omitidas por servicios externos.

[Gate 41403091427](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41403091427) señaló exclusivamente dos contratos que exigían el identificador anterior de caché. Se actualizaron `frontend-version-aislamiento-personal.test.js` y `hormiga-version-javascript-personal.test.js` a `20261102-restauracion-caja-v81`, conservando sus comprobaciones de sesión y del único script personal. Exigir CI del nuevo HEAD antes de dar el lote por verificado; este fallo no se omite ni se desactiva. No desplegar.

## Checkpoint del 2 de noviembre de 2026 — recuperación de abonos recurrentes

Partida verificada: `73d846fda3431f87d7202979588a72e326f9976b`, PR #389 abierto sobre `feature/finanzas-personales` (`f44a0535ad86ac7f10a90be6a700cfc8618a43e0`); #407 abierto. Ese SHA completó [Gate 41403290372](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41403290372), [Seguridad 41403290371](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41403290371) y [V81 41403290382](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41403290382) en success. Checkout separado, actualización remota con HEAD esperado. No se cambian main, Empresarial ni Blushéa.

Se amplía RESTAURACION V5 a gastos que sean abonos vinculados a una obligación recurrente. La fuente recurrente misma continúa sin admitir compensación; cuotas financiadas, pagos de préstamos y documentos físicamente borrados siguen fuera de este flujo. Los límites anteriores de caja simple describen el lote previo; este bloque añade únicamente abonos recurrentes.

| Aceptación del bloque | Comportamiento y evidencia |
| --- | --- |
| Período exacto | Recalcula el ciclo colombiano desde la fecha del origen y del pago original, sin trasladarlo al día de restauración; valida fecha no futura y no duplicar el primer período ya asentado |
| Cupo íntegro | Suma con BigInt los abonos compensados vigentes y exige que total + importe restaurado no supere la obligación; el abono anulado debe estar ausente de ese total |
| Reserva coherente | Índice físico único exacto sobre usuarioId, origenId y periodoInicio; rechaza filtros parciales, sparse, TTL y collation no binaria. Reserva existente debe coincidir con período, importe de cuota y total vigente; no crea ni repara reservas |
| Atomicidad e idempotencia | CAS de reserva, evento V5, cursor, saldo y outbox dentro de la misma transacción; repetir el mismo recibo no ajusta reserva ni caja otra vez |
| Concurrencia | Restauración y pago nuevo compiten por la misma reserva. Si no hay cupo para ambos, solo uno puede confirmar; no se acepta sobrepago |
| Lecturas y recuperación accesible | Caja admite el delta V5 de un abono; el historial de anulados ofrece el botón existente, conservando confirmación y referencia exacta a la anulación. No cambia el JS ni su versión de caché |
| Auditoría | Outbox conserva origen, inicio/fin del ciclo, importe de cuota y total reservado posterior, además del hash de compensación. Las fuentes originales y eventos anteriores permanecen intactos |
| Fallos | Usuario ajeno, origen ausente, pago aún activo, cupo ocupado, reserva desincronizada, índice inseguro o saldo insuficiente fallan cerrado; error de outbox revierte también la reserva |

Validación local: 253 pruebas aprobadas, nueve integraciones omitidas por necesitar servicios externos y cero fallos; sintaxis y diff revisados. No atribuir ejecución local a MongoDB. El ensayo `restauracionRecurrenteAutorizada.js`, integrado en el fixture con rol restringido, debe aprobar en CI: reserva 100 → 40 al anular → 100 al restaurar, reintentos simultáneos, carrera contra un pago nuevo, referencia anterior, aislamiento, reconstrucción de caja, fuente preservada, rollback de auditoría/saldo y rechazo de reserva alterada solo en el ensayo.

```bash
node --test test/finanzas-personales/*.test.js test/gruk/restaurar-reserva-compensada.test.js test/gruk/restauracion-compensada-personal.test.js test/gruk/evento-compensatorio-personal.test.js test/gruk/estado-compensado-personal.test.js test/gruk/registrador-compensacion-personal.test.js test/gruk/consulta-compensada-personal.test.js
npm run check:syntax
```

Sin migraciones, borrados, reparaciones automáticas, cambios de roles ni acceso a datos reales. Los tests usan usuarios nuevos y datos ficticios en MongoDB aislado. No se afirma recuperación garantizada, custodia independiente ni aprobación de producción.

Siguiente paso: confirmar CI del SHA publicado y preparar recuperación de cuotas financiadas/pagos de préstamos con su capital, pago real y calendario propios. No habilitar estos casos mediante restauración genérica de caja. Persisten custodia real de #407, auditoría de permisos/índices y compatibilidad histórica de producción, backups independientes con retención/acceso separado, RPO/RTO y restauración aislada medidos, y dispositivos reales. Mantener sin fusión ni despliegue hasta completar todos los criterios.

### Evidencia del lote recurrente

Código publicado con lease: `7e92724b449ca21cc748ab3b2ddbcefbaf48f6dd`. Las tres validaciones del SHA exacto terminaron en success: [Gate 41419735209](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41419735209), [Seguridad 41419735348](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41419735348) y [V81 41419735208](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41419735208). Sus siete jobs V81 aprobaron, incluido `mongo-privileges-v81` (`125192137549`) con el nuevo caso recurrente. La prueba confirmó reserva y caja conservadas ante carreras y fallos.

Este checkpoint posterior solo registra evidencia. Verificar el HEAD documental y su CI antes de continuar. No es despliegue, no cierra #407 y no acredita permisos/custodia/backup de producción.

## Checkpoint del 2 de noviembre de 2026 — cuotas de compras financiadas

HEAD verificado: `b9dee0832d45949e3fc3c780261413df1a6f0933`; PR #389 abierto sobre feature/finanzas-personales (`f44a0535ad86ac7f10a90be6a700cfc8618a43e0`) y #407 abierto. CI de partida: [Gate 41419972185](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41419972185), [Seguridad 41419972218](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41419972218), [V81 41419972156](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41419972156), todos success. Checkout aislado y publicación con lease; no modificar main ni desplegar.

Este bloque recupera pagos anulados de `compromisosCuotas`, manteniendo separada la recuperación de pagos de préstamos. No convierte un PAGO_DEUDA arbitrario en ingreso/gasto ni permite saltar el calendario. Los límites de los checkpoints anteriores corresponden a aquellos lotes; ahora se añade este flujo específico.

| Aceptación | Implementación y evidencia |
| --- | --- |
| Fuente exacta | Compromiso y número se obtienen de la descripción canónica del pago original, con propietario autenticado; ambos se vuelven a comprobar dentro de la transacción |
| Evento append-only | RESTAURACION V6 para PAGO_DEUDA sin préstamo, ligado a la anulación vigente. V1–V5 conservan sus payloads y hashes; originales y eventos anteriores no se reescriben |
| Calendario coherente | Solo la siguiente cuota pendiente, con importe exacto y padre conciliable; restaura transaccionId y fecha del pago original, contador y saldo. La última cuota deja FINALIZADA con saldo cero |
| Caja separada | CUENTA descuenta de la misma cuenta propia activa; HISTORICO conserva efecto de caja cero y no inventa cuenta de origen |
| Atomicidad | Cuota, padre, evento, cursor, caja y outbox en una transacción. Falta de saldo o fallo de auditoría revierten toda la unidad |
| Reintentos y carreras | Clave por anulación; recibo repetido no vuelve a aplicar efectos. Pago nuevo y restauración compiten por la misma cuota y solo uno confirma |
| Interfaz y autorización | Historial de anulados ofrece Restaurar mediante la ruta existente con confirmación true, JWT e Idempotency-Key. El despachador no acepta compromiso/numero del cuerpo y rechaza préstamos hasta su flujo propio |
| Lecturas | Historial, estado compensado y caja reconocen V6; recibo devuelto exige consultar estado actual, sin afirmar que una restauración antigua siga vigente |

JavaScript versionado `20261102-restauracion-cuotas-v81`; la confirmación dice que se reaplica el efecto financiero, sin prometer un débito para pagos históricos. Los dos contratos de caché se actualizan junto al HTML.

Validación local: 256 pruebas aprobadas, nueve omitidas por servicios externos, cero fallos; sintaxis y diff revisados. No hay MongoDB local. El caso `restauracionCompromisoAutorizada.js` se incorpora al fixture con rol restringido de CI: CUENTA/HISTORICO, fuente intacta, idempotencia concurrente, referencia antigua, aislamiento, lectura/caja, última cuota, carrera contra pago nuevo, rollback de outbox y saldo insuficiente. Las omisiones locales no acreditan esa integración.

```bash
node --test test/finanzas-personales/*.test.js test/gruk/restauracion-compensada-personal.test.js test/gruk/restauracion-movimiento-despacho.test.js test/gruk/registrador-compensacion-personal.test.js test/gruk/estado-compensado-personal.test.js test/gruk/evento-compensatorio-personal.test.js test/gruk/consulta-compensada-personal.test.js test/gruk/frontend-version-aislamiento-personal.test.js test/gruk/hormiga-version-javascript-personal.test.js
npm run check:syntax
```

Sin migraciones, borrados, reparación de históricos ni cambios de roles de producción. Un lector anterior que no admite V6 fallará cerrado ante esos eventos; todavía se debe probar reversión operativa compatible antes de liberar. DOM simulado no equivale a validación en dispositivos.

Próximo bloque: recuperación específica de pagos de préstamos, con capital y pago real diferenciados, saldo y secuencia de cuotas verificables. No habilitarla por el despachador genérico hasta completarla y probarla. Siguen pendientes eliminación recuperable de otros registros mutables, custodia independiente real de #407, históricos/permisos/índices de producción, backup independiente con retención y acceso separado, restauración aislada y RPO/RTO medidos, y pruebas en dispositivos. No fusionar ni desplegar.

### Evidencia inicial y contrato de reintento

Implementación publicada con lease: `f0cb299951a530f05242936a24e88bf36a919d96`. [Gate 41424236866](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424236866) y [Seguridad 41424236823](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424236823) aprobaron. [V81 41424236922](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424236922) detectó en el ensayo nuevo una comparación demasiado amplia del reintento exitoso: revisionCompatibilidad del cerrojo mutable avanzó de 4 a 5, sin diferencias financieras. Los otros seis jobs V81 aprobaron.

La prueba ahora exige que la revisión del cerrojo avance exactamente uno al repetir una operación exitosa; saldo, padre, cuotas, originales, outbox, eventos, secuencia y hash deben permanecer idénticos. Los rechazos y fallos de auditoría siguen comparando la foto completa, incluida esa revisión, porque una transacción abortada no debe conservar su avance. No se modifica la serialización para satisfacer la prueba. Exigir la ejecución completa del nuevo SHA antes de dar la integración por verificada.

### Verificación completa del lote de cuotas

SHA de implementación y prueba corregida: `14cb89a0e694766e52dcd938c7714c8eaad891a7`. Las tres validaciones del SHA exacto terminaron en success: [Gate 41424520463](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424520463), [Seguridad 41424520464](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424520464) y [V81 41424520460](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424520460). Sus siete jobs V81 aprobaron, incluido MongoDB autenticado (`125207776193`) con recuperación de cuotas, concurrencia y rollback. No hay fusión ni despliegue.

Este registro posterior es documental: comprobar HEAD y CI del commit documental antes de continuar. Siguiente paso independiente: pagos de préstamos, manteniendo diferenciados capital, pago real y secuencia; todavía no están habilitados para restauración. #407 y la evidencia externa de custodia/backup/producción continúan pendientes.

## Checkpoint del 2 de noviembre de 2026 — recuperación de pagos de préstamos

Partida verificada: `5182d4042bfb17bba43794207ab93b307e34dc7a`, PR #389 abierto sobre feature/finanzas-personales (`f44a0535ad86ac7f10a90be6a700cfc8618a43e0`) y #407 abierto. CI de partida: [Gate 41424781897](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424781897), [Seguridad 41424781902](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424781902), [V81 41424781866](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41424781866), todos success. Checkout aislado y publicación con HEAD esperado; no tocar main ni desplegar.

Se añade recuperación específica de PAGO_DEUDA vinculado a un préstamo POR_PAGAR. Los límites anteriores describen los lotes previos: ahora se habilita ese caso con sus verificaciones propias. No se elimina ni recrea el pago original, no se recalculan intereses y la diferencia entre pago real y capital no se clasifica automáticamente como interés.

| Aceptación | Implementación y prueba |
| --- | --- |
| Importes separados | RESTAURACION V7 conserva capital, pago real, número de cuota, préstamo e impactoCaja; capital reduce deuda y pago real afecta cuenta. HISTORICO conserva caja cero |
| Fuente y autorización | Despachador obtiene préstamo desde la fuente propia y verifica formato de cuota; el servicio lo comprueba otra vez dentro del snapshot. No acepta préstamo ni capital del cuerpo |
| Secuencia y saldo | Préstamo activo/vencido con calendario confirmado; pagos vigentes sin huecos; solo se recupera la siguiente cuota y capital compatible con cuota, saldo actual y pago real originales |
| Estado final | Saldo cero queda PAGADO y desactiva periodicidadConfirmada, igual al flujo de pago. No reprograma el vencimiento |
| Atomicidad | Evento, cursor, cuenta, deuda y outbox dentro de una transacción; saldo insuficiente o error de auditoría revierten toda la unidad |
| Idempotencia y concurrencia | Recibo ligado a anulación exacta; reintento no duplica capital ni caja. Pago nuevo y restauración compiten por el mismo préstamo; referencia obsoleta o cuota fuera de orden se rechaza |
| Historial y caja | Historial ofrece Restaurar al pago verificable; lectura compensada y proyección de caja reconocen V7, con delta en la fecha de compensación. No cambia el JS ni la confirmación existente |

La validación de pagos conserva el criterio previo de capital histórico: no inventa cuotas anteriores ausentes. Este flujo requiere evidencia suficiente para el caso identificado y no certifica completitud del historial ni saldo bancario.

Pruebas locales de evento V7, despacho e historial aprobadas. Suite ampliada y sintaxis se ejecutan antes de publicar; las integraciones que requieren servicios externos no se presentan como comprobadas localmente. `restauracionPrestamoAutorizada.js` se incorpora al fixture con MongoDB y rol restringido: capital 400/pago real 450, CUENTA/HISTORICO, pago parcial, cierre PAGADO, idempotencia, aislamiento, caja desde anclas, carrera contra pago nuevo, hueco de secuencia, referencia vieja, rollback de outbox y saldo insuficiente. Compara fuente original y estados financieros; el cerrojo mutable solo puede avanzar en un reintento exitoso, no al abortar.

```bash
node --test test/finanzas-personales/*.test.js test/gruk/restauracion-compensada-personal.test.js test/gruk/restauracion-movimiento-despacho.test.js test/gruk/evento-compensatorio-personal.test.js test/gruk/estado-compensado-personal.test.js test/gruk/registrador-compensacion-personal.test.js test/gruk/consulta-compensada-personal.test.js
npm run check:syntax
```

V1–V6 mantienen payload/hash. Un lector anterior que no admite V7 fallará cerrado: la compatibilidad de reversión operativa sigue pendiente antes de liberar. Sin cambios de roles, migraciones, borrados, reparaciones ni datos reales.

Siguiente paso: confirmar CI del SHA publicado e inventariar eliminación/recuperación de los demás registros mutables (deudas retiradas, cuentas, metas y configuración), sin confundir cancelación con borrado físico. Priorizar además el ejercicio reproducible de backup y restauración aislada con retención, acceso separado y RPO/RTO medidos. Custodio independiente real de #407, auditoría de históricos/permisos/índices de producción y dispositivos siguen pendientes. Mantener sin fusión ni despliegue.

### Evidencia inicial y límite de conciliación histórica

Implementación `57db156dd8b1d2272b39d0451a4c702f5145c028`: [Gate 41431483317](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431483317) y [Seguridad 41431483356](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431483356) aprobaron. [V81 41431483409](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431483409) encontró una expectativa incorrecta del ensayo HISTORICO: la reconstrucción de saldo desde anclas rechaza movimientos sin cuentaId posteriores al ancla, aunque no tengan efecto actual de caja. Los otros seis jobs V81 aprobaron.

Se conserva esa defensa. La prueba exige para CUENTA saldo reconstruido exacto y, para HISTORICO, ausencia de deltas efectivos, cuenta intacta y rechazo 409 de conciliación hasta identificar el origen. Recuperar el estado del préstamo no convierte el pago histórico en dinero conciliado. No se asigna cuenta ficticia ni se omite la guardia para que CI apruebe. La suite local ampliada sumó 256 aprobadas y nueve omitidas por servicios externos; exigir CI completa del nuevo HEAD.

### Verificación del lote de préstamos

SHA de implementación y ensayo corregido: `8c94a54917c63990276f74ec30ac13a6d326bf65`. Las tres validaciones del SHA exacto terminaron en success: [Gate 41431762896](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431762896), [Seguridad 41431762987](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431762987) y [V81 41431762952](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431762952). Sus siete jobs V81 aprobaron, incluido MongoDB autenticado (`125231787953`) con capital/pago real diferenciados, cierre, secuencia, concurrencia, conservación y rollback.

Este checkpoint posterior es documental. Consultar HEAD y CI del commit documental antes de continuar. Sin fusión ni despliegue; #407 continúa abierto y no se acredita custodia independiente, backup ni configuración real de producción.

## Checkpoint del 2 de noviembre de 2026 — ensayo de backup financiero

Partida verificada: `827d1cee35071a77767e12ff95a462bfc64d4876`, PR #389 abierto y #407 abierto. CI de partida: [Gate 41431958980](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431958980), [Seguridad 41431958939](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431958939), [V81 41431958945](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41431958945), todos success. Checkout separado y publicación con lease. Sin main, Empresarial, Blushéa ni Render.

### Inventario y decisión

`retirarDeudaVisible` conserva el saldo pero cambia estado a CANCELADO y periodicidadConfirmada a false sin conservar todo el estado previo en un historial independiente. No se puede restaurar ese calendario automáticamente con certeza a partir del outbox actual. El retiro de crédito legacy solo desactiva su bandera y debe distinguirse de una incorporación al modelo nuevo, para no duplicar deudas. Estos flujos necesitan captura previa y recuperación propias; no están resueltos por la recuperación de pagos. No inferir estados anteriores ni reactivar todos los cancelados.

Se implementa mientras tanto un bloque independiente de protección: servicio interno de backup cifrado y restauración exclusivamente en base nueva de ensayo local. No se añade ruta HTTP, despliegue ni acceso a producción.

| Aceptación | Comportamiento verificable |
| --- | --- |
| Alcance explícito | Doce colecciones: cinco fuentes/evidencias protegidas, cursor compensatorio, cuentas, reservas recurrentes, préstamos, compromisos, cuotas y outbox. No es backup completo de identidad, suscripciones, activos, metas o configuración |
| Captura de datos | Lectura BSON cruda en una transacción snapshot, sin insertar/actualizar/borrar en origen; hasta 5.000 documentos por colección y payload JSON de 16 MiB. Lectura incremental y rechazo ante capacidad insuficiente |
| Catálogo e índices | Exige todas las colecciones ordinarias previstas, sin opciones especiales. Contrasta UUID y definición de índices antes/después; conserva claves, nombres y opciones soportadas. Rechaza TTL en este alcance financiero |
| Protección del paquete | AES-256-GCM con nonce aleatorio, AAD y clave de 32 bytes suministrada fuera del archivo. Hashes BSON por colección y SHA256 del archivo; retenerHasta explícito, autenticado dentro del paquete |
| Restauración aislada | Solo mongodb://127.0.0.1:27018/gruk_v81_restore_test_ + 16 hex, sin credenciales en URI ni query/hash, y NODE_ENV distinto de production. Crea su propia conexión directa y no admite otro destino |
| No sobrescribir | Base completamente vacía, reclamación exclusiva por colección guardia. Sin drop, truncate, reemplazos ni limpieza automática. Un fallo deja el destino incompleto en cuarentena; un segundo intento contra esa base se rechaza |
| Verificación | Reinsertar documentos con tipos BSON preservados, reconstruir índices y comparar número/hash de documentos y definición de índices. Solo después marcar VERIFICADO |
| Métricas | capturaMs, restauracionMs, bytes, documentos y edadRespaldoMs. Son medidas del ensayo, no RPO/RTO de producción ni prueba de custodia independiente |

Pruebas locales: cifrado/descifrado con ObjectId, Decimal128, Long fuera del rango seguro y Date; clave incorrecta, alteración, manifiesto incompleto, TTL, y destinos externos/producción se rechazan. La suite local ampliada terminó con 214 aprobadas, nueve omitidas por servicios externos y cero fallos; no se presenta como MongoDB real local.

La nueva integración `respaldoFinancieroAutorizado.js` usa reader con rol read y prueba rechazo MongoDB código 13 ante escritura. Captura las doce colecciones ficticias del fixture; escribe el paquete cifrado con permisos 0600 y flag wx, sin clave en disco; crea una credencial distinta con readWrite únicamente en una base nueva de ensayo. Restaura, verifica y rechaza sobrescribir el destino. Un segundo paquete ficticio con _id duplicado debe dejar la restauración parcial en cuarentena, sin borrar documentos ni admitir reintentos sobre esa base. Un registro de cuenta posterior a la captura no aparece en el destino, mostrando el límite temporal del paquete. Emite únicamente métricas, sin documentos, claves ni URI. No borra origen, destino ni paquete: todo pertenece al contenedor/tmp efímeros de CI.

```bash
node --test test/gruk/respaldo-financiero-personal.test.js
node --test test/finanzas-personales/*.test.js
npm run check:syntax
```

### Pendientes externos y de alcance

El paquete de CI no constituye backup independiente de producción: está en el mismo entorno efímero y carece de destino duradero/custodio externo. retenerHasta es metadato, no un control WORM ni una política de borrado. No se configura tarea de limpieza. Faltan destino independiente autorizado, gestión/recuperación/rotación de claves separadas, control real de retención y acceso, alertas de antigüedad y ejercicios periódicos. No se contratan servicios ni aumentan costos.

No se midió RPO de producción: edad del respaldo y duración de captura no demuestran tiempo de pérdida respecto de la última escritura confirmada. RTO de producción exige infraestructura, volumen y procedimiento reales; los milisegundos del ensayo solo miden esa restauración ficticia. Cambios administrativos de esquema concurrentes quedan sujetos al contraste previo/posterior; no se certifica ausencia de DDL hostil. La restauración de prueba no inicia la aplicación ni acredita sus roles, índices/gates funcionales o compatibilidad operativa en producción.

Siguiente paso: confirmar CI y registrar métricas del SHA publicado; definir captura append-only previa al retiro de registros mutables para permitir recuperación sin inferencias. Mantener #407, custodia independiente real, backup completo, históricos/permisos/índices de producción, RPO/RTO reales y dispositivos como pendientes. Sin fusión ni despliegue.

### Evidencia verificada del ensayo de backup

Implementación `194ea9f77dce804c1cfb11ed0256413f8daaabac`, publicada con lease sobre `827d1cee35071a77767e12ff95a462bfc64d4876`. CI del SHA exacto: [Gate 41440432314](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41440432314), [Seguridad 41440432634](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41440432634) y [V81 41440432430](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41440432430), todos success. Los siete jobs V81 aprobaron. MongoDB autenticado (`125260631837`) ejecutó 31 pruebas, cero fallos y cero omisiones; incluye lector sin escritura, BSON/índices restaurados, captura temporal, rechazo de sobrescritura y cuarentena tras fallo parcial.

Métricas del fixture: 12 colecciones, 449 documentos, paquete cifrado de 427.502 bytes, captura 35 ms, restauración 284 ms y edad del paquete al terminar 318 ms. No representan volumen, custodia independiente, retención efectiva ni RPO/RTO de producción. La clave no se guardó con el paquete; faltan gestión y recuperación independientes reales.

Este checkpoint documental debe comprobarse en el HEAD remoto y su CI antes de retomar. Próximo bloque: captura append-only del estado previo al retiro de deudas y recuperación explícita del propietario, sin inferir calendarios históricos ni duplicar obligaciones. El backup completo y durable con custodio independiente, retención/acceso separado y ensayo operativo real siguen pendientes, al igual que los demás criterios de #407. Sin fusión ni despliegue.

## Checkpoint del 2 de noviembre de 2026 — retiro recuperable de deudas

Partida real `125368f4849238f0369641c428ee6dfa21daa5cd`, PR #389 abierto con base feature/finanzas-personales (`f44a0535ad86ac7f10a90be6a700cfc8618a43e0`), #407 abierto. [Gate 41440725298](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41440725298), [Seguridad 41440725207](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41440725207) y [V81 41440725218](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41440725218) de partida success. Sin AGENTS.md en el workspace; se revisaron README personal, continuidad, rutas, provisión, arranque y CI. Checkout separado, sin ejecución concurrente ni cambios en main/Empresarial/Blushéa.

### Bloque y aceptación

Se sustituye el retiro sin retorno de préstamos POR_PAGAR por RETIRO/RESTAURACION en `fin_retiros_deudas_personales_v1`. El préstamo sigue siendo una proyección mutable; los eventos conservan snapshots anterior/posterior de sus campos financieros, sin reescribir eventos ni fuentes de pagos. El retiro cambia exclusivamente estado y confirmación de periodicidad, más cursor de recuperación; no borra documentos, reduce deuda ni registra pagos.

| Criterio | Implementación y prueba exigida |
| --- | --- |
| Propietario y consentimiento | Identidad de personalAuth, no del cuerpo. confirmacion estrictamente true y solicitudId estable obligatorio en el servidor. Estados ACTIVO/VENCIDO, saldo positivo seguro, únicamente POR_PAGAR |
| Evidencia conservada | Eventos append-only con secuencia por deuda, hashes enlazados, snapshots y fecha. Hooks de consultas/documentos y rol MongoDB sin UPDATE/DELETE para la nueva colección |
| Atomicidad | Evento, cursor/estado del préstamo y outbox en una transacción snapshot/majority. Rollback ante fallo de auditoría, sin cambios de cuentas ni fuentes |
| Recuperación | POST /prestamos/:id/restaurar-retiro exige retiroHash del último retiro. Compara todos los campos financieros actuales con el snapshot posterior; restaura estado/confirmación previos sin recalcular calendario, saldo, tasa ni fecha |
| Reintentos | Unicidad usuario/solicitud y usuario/deuda/secuencia. Misma solicitud devuelve recibo sin escribir; vigente=false si ya hubo otra operación. Referencias obsoletas y solicitud reutilizada para otra operación se rechazan |
| Concurrencia | La escritura del mismo préstamo coordina retiro/recuperación con pagos y ediciones. No se retira una deuda con ninguna fuente vinculada, incluso anulada. Ensayo de carrera contra pago exige un solo ganador y caja coherente |
| Integridad y capacidad | Verifica cadena completa y cursor antes de actuar, hasta 1.000 eventos por deuda; consultas con maxTimeMS 5 s. Truncamiento, hash alterado, cursor incoherente y registro cancelado modificado se rechazan |
| Índices y permisos | Dos índices únicos exactos requeridos en caliente y antes de escuchar HTTP. Nuevo historial incluido en auditoría conservadora de privilegios y búsqueda heurística. Provisión administrativa separada; la aplicación no crea/repara índices |
| Interfaz | Sección Deudas retiradas con recuperación por hash. Confirmación, bloqueo de doble clic, misma solicitud tras error y descarte al cambiar sesión. Los retiros anteriores sin evidencia muestran revisión pendiente |
| Backup compatible | Payload V2 agrega la colección de retiros: trece colecciones. Sigue descifrando/restaurando payloads V1 de doce colecciones, sin inventar historial faltante. La envoltura criptográfica AES-GCM V1 permanece compatible |

Los créditos legacy conservan sus datos: DELETE /creditos/:id devuelve 409 hasta contar con su propio flujo recuperable. La incorporación con confirmación sigue disponible; no se confunde una incorporación con un retiro. Los clientes anteriores que enviaban DELETE /prestamos/:id sin confirmación/solicitud reciben 400; actualizar interfaz conjuntamente. Caché JavaScript `20261102-recuperacion-retiros-v81`.

### Validación y límites

Pruebas locales de interfaz, integridad de hashes, hooks append-only, contrato de identidad de la ruta, rechazo seguro de errores y compatibilidad de backup V1 aprobaron. La suite local ampliada previa a los cuatro contratos finales sumó 233 aprobadas, nueve omitidas por servicios externos y cero fallos; los cuatro contratos finales aprobaron por separado. `npm run check:syntax`, node --check de archivos nuevos y git diff --check aprobaron. MongoDB autenticado se exige en CI: normal/reintentos, ACTIVO/VENCIDO, calendario modificado entre ciclos, aislamiento, concurrencia, préstamo con fuentes anuladas, índices ausentes, corrupción administrativa y rollback de retiro/restauración. No se presenta como prueba de MongoDB local.

La política ahora exige seis colecciones protegidas: credenciales antiguas sin privilegios adecuados para la nueva colección bloquearán el arranque. Antes de producción se requiere provisión administrativa explícita de colección/índices y revisión del rol efectivo sin UPDATE/DELETE. El lector de backup necesita lectura de la colección adicional. No se modifican roles/índices ni datos de producción durante este lote. Una reversión a un servidor anterior ignoraría los nuevos cursores/flujos; validar compatibilidad operativa antes de liberar.

La cadena local no impide reescritura coherente por un administrador con acceso a eventos y proyección; falta custodia independiente real. No recupera documentos físicamente borrados ni retiros anteriores que carezcan de snapshot. No resuelve eliminación/recuperación de metas, cuentas, activos, configuración o crédito legacy, ni convierte todas las correcciones de préstamos en eventos inmutables. El backup parcial verifica conservación BSON/índices, no la veracidad financiera de las fuentes ni un arranque funcional del destino restaurado. Custodia, backup completo durable, claves independientes, retención efectiva, RPO/RTO reales, históricos/permisos/índices de producción, auditoría externa si corresponde y dispositivos siguen pendientes.

Siguiente paso: publicar con lease, verificar CI del SHA exacto y registrar evidencia; después implementar recuperación del retiro legacy sin duplicar deudas incorporadas y completar inventario de otros registros recuperables. Mantener #407 abierto, sin fusión ni despliegue.

### CI inicial y corrección del ensayo

Implementación `77a07a545b7f84dbd70b5d4bef263231a9209f11`: [Seguridad 41448601909](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41448601909) aprobó. [Gate 41448601925](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41448601925) detectó dos expectativas estáticas de la versión anterior del JavaScript; se actualizan al valor publicado, manteniendo comprobación exacta. [V81 41448602133](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41448602133) aprobó seis jobs y detectó en mongo-privileges un documento ficticio de fuente anulada sin categoria obligatoria. Se completa el fixture, sin cambiar esquema ni retirar validaciones. Los casos anteriores del nuevo helper habían avanzado hasta ese punto; exigir nuevamente toda la CI antes de aceptar el bloque.

### Verificación completa del retiro recuperable

SHA de implementación y ensayo corregido `8d8bd55a9fd9afbc8a12151cc9d7ea7185877fd9`: [Gate 41448846494](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41448846494), [Seguridad 41448846457](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41448846457) y [V81 41448846455](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41448846455), todos success. Sus siete jobs V81 aprobaron. MongoDB autenticado (`125288681684`): 32 pruebas, cero fallos y cero omisiones; el helper de retiro completo aprobó normal, restauración, ciclo posterior a edición, idempotencia, referencia obsoleta, aislamiento, rollback, índices, fuente anulada, corrupción y carrera con pago. El arranque real rechazó además el índice único de retiros ausente y volvió a HTTP 200 tras provisión administrativa en el contenedor de prueba. Los seis historiales se probaron con rechazo MongoDB código 13 a modificaciones/borrados.

El ensayo de backup V2 capturó y restauró 13 colecciones y 491 documentos ficticios, 478.674 bytes cifrados; captura 36 ms, restauración 574 ms y edad del paquete 636 ms. Son medidas del fixture, sin custodia independiente ni RPO/RTO de producción. La lectura de paquetes V1 de doce colecciones tiene prueba unitaria de compatibilidad. Los archivos remotos publicados se compararon byte a byte con el lote local validado.

Este checkpoint posterior es documental; consultar su HEAD remoto y CI antes de continuar. Revisados nuevamente cuerpo y cuatro comentarios de #407: permanece abierto, sin nueva evidencia externa de custodia o configuración real. Siguiente bloque: retiro/recuperación legacy con identificación inequívoca de deudas ya incorporadas, preservación y transacción; no reactivar créditos automáticamente. Permanecen los límites de alcance y gates descritos arriba. Sin fusión ni despliegue en Render.
