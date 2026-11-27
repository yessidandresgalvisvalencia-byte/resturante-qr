# Resumen HTTP: contrato 2 y consumidores seguros

Un bloque funcional: GET /resumen usa la misma vista MongoDB para Home, ingresos históricos compensados hasta el corte, metas activas y perfil. Home.obtenerEnSesion exige ID, fecha y transacción activa; no abre una sesión aparte. Las consultas se esperan secuencialmente y el resultado no se entrega si falla lectura, commit o cierre. Se conservan límites previos del ledger/patrimonio y se agrega límite verificable 500+1 a metas con maxTimeMS de cinco segundos.

Ingresos, gastos, consumo, cobros y pagos coinciden con Home al mismo corte. No se transforma cuota cero en saldo total exigible. La suma histórica usa enteros/BigInt y conserva originales compensados; no incluye ingresos posteriores al corte. Se observan versiones vigentes de las fuentes en el snapshot: no se afirma reconstruir su versión histórica ni el timestamp interno de MongoDB.

| Campo/criterio | Contrato |
| --- | --- |
| Ingresos/gastos/deuda | Se mantienen nombres monetarios enteros que usa el panel. Cobros registrados y flujo realizado se exponen separados |
| Compromisos | cuotasDeudaRegistradas conserva la suma de Home; cuotasDeuda, flujoProyectado y ratios de proyección son null si faltan cuotas/fechas/periodicidad mensual confirmadas. La proyección solo resta cuotas registradas, no es presupuesto completo |
| Flujo libre/ahorro | flujoLibre=null, tasaAhorroPct=null, autorizaGasto=false; un neto positivo no prueba ahorro ni capacidad |
| Ratios | BigInt: numerador/denominador/factor y decimal como texto, con dos posiciones y redondeo MITAD_HACIA_ARRIBA explícito. Denominador cero devuelve null; no se convierte a 0% |
| Fondo | Saldo solo con caja conciliada; perfil.saldoLiquido no la sustituye. Objetivo ausente no inventa seis meses. Un valor guardado de objetivo se etiqueta objetivoConfirmado=false; no prueba declaración expresa |
| Cobertura | mesesCubiertos=null. ratioLiquidezGastoRegistrado es relación con gasto registrado del período, no supervivencia futura o fondo certificado |
| Metas | Dueño/ID únicos y montos enteros no negativos, sin coerción. Objetivo cero se conserva con porcentaje null; superar objetivo puede dar más de 100%, sin recortar ni cambiar estado |
| HTTP | Dueño de sesión, Cache-Control private/no-store; error sanitizado sin cuerpo parcial. Rutas derivadas plan/análisis/evaluación también controlan errores |
| Consistencia | Una escritura externa de ingreso, meta y perfil durante la consulta no se mezcla con Home anterior; consulta posterior observa cambios completos |

## Protección de consumidores y trabajo pendiente

Plan financiero y evaluación de crédito ya no convierten flujoLibre=null ni el flujo proyectado en reserva/capacidad. Devuelven estado explícito PENDIENTE_PLAN_VERIFICABLE/PENDIENTE_EVALUACION_EXACTA, importes de asignación y proyección de crédito null y requisitos pendientes. El análisis no declara SIN_ALERTA_CRITICA o CAPACIDAD_INVERTIBLE a partir de esos datos desconocidos. Puede describir flujo registrado negativo sin autorizar movimientos.

Esto no completa un plan personalizado ni una evaluación de crédito: falta la simulación monetaria exacta con calendario/cargos y la definición verificable de objetivos/liquidez. POST /creditos/simular conserva por ahora su implementación antigua separada; no se utiliza para evaluar capacidad y sigue siendo un pendiente obligatorio antes de liberar. No se deshabilita ningún gate ni se presenta ese simulador como exacto o listo.

Compatibilidad: el panel actual usa ingresos/gastos/deuda enteros y Home para el flujo visible; los campos de ratios ahora son texto/null y flujoLibre/mesesCubiertos/tasaAhorroPct pueden ser null. Otros consumidores deben respetar este contrato sin coerción a cero. La compatibilidad de producción y dispositivos reales no se acredita con unit tests.

La lectura no cambia cuentas, historial, metas, perfil, índices o roles. Metadatos de fixture modificados para demostrar aislamiento o corrupción pertenecen solo a CI. La completitud histórica/semántica de todas las fuentes, cuotas no mensuales, simulación/plan restantes y gates de #407/custodia independiente/backup durable/restauración real/seguridad/dispositivos siguen pendientes. Sin despliegue parcial.

Actualización posterior: el simulador separado fue sustituido por el contrato 2 descrito en SIMULACION_CREDITO_V81.md. La referencia anterior a su implementación antigua describe el checkpoint del resumen HTTP; ya no es el estado del simulador. La integración de evaluación contractual/capacidad y plan verificables sigue pendiente, sin autorizar crédito.
