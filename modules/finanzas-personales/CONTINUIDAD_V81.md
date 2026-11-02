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
