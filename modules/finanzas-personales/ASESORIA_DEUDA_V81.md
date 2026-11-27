# Deuda contextual y comparación de abonos

DEUDA_CONTEXTUAL, ASESORIA_DEUDA_CONTEXTUAL y COMPARACION_ABONO_DEUDA releen la deuda seleccionada en una transacción snapshot de solo lectura. Filtran por ID, propietario y dirección POR_PAGAR, con estado ACTIVO/VENCIDO y maxTimeMS de cinco segundos. La selección conversacional es preliminar: no se usan sus saldos para responder. Si falla apertura, lectura, commit o cierre no se publican importes parciales; deuda ausente, retirada o ajena tiene respuesta no verificable.

C2 exige principal positivo, saldo entre cero y principal y cuota no negativa, todos enteros seguros sin coerción. Cuota cero (default histórico) se presenta como desconocida, no como pago exigible cero. Principal menos saldo se calcula con BigInt como diferencia registrada: no acredita abonos, amortización real ni origen de cambios. abonadoMinor, mesesEstimados, disponibleMinor y abonoSugeridoMinor permanecen null. No se divide saldo entre cuota para prometer un plazo.

## Escenario exacto de un mes

Solo tasaConfirmada=true y una tasa mensual numérica entre 0 y 100, cuyo decimal canónico tenga hasta seis posiciones, permiten calcular el escenario. La representación decimal almacenada se convierte a coeficiente BigInt y escala; saldo × coeficiente / (100 × escala) se conserva como numerador/denominador y texto decimal exacto. No se multiplica dinero por Number, no se usa Math.round/toFixed ni se redondea silenciosamente. Ejemplo: saldo 12.345 COP y tasa mensual 2,5% producen 308,625 COP bajo ese supuesto.

El resultado supone saldo constante durante un mes, sin pagos, capitalización, seguros, impuestos, comisiones ni otros cargos. No constituye una liquidación, tasa efectiva anual, costo de prepago o ahorro garantizado. Puede contener fracciones de centavo: no se guarda ni cobra ese importe; liquidar exige reglas de redondeo/base/fechas del acreedor. El decimal canónico del campo Number almacenado no prueba la exactitud del contrato original; valores con más precisión, notación exponencial o incoherentes quedan pendientes sin convertirlos a cero ni corregir la fuente.

| Aceptación | Comportamiento y prueba |
| --- | --- |
| Tasa ausente/no confirmada | No presupone 0%; escenarioInteres=null y motivo explícito |
| Cero confirmado | Escenario cero bajo los mismos supuestos, sin afirmar ausencia de otros costos |
| Dinero exacto | Fracciones, tasa mínima soportada, saldo MAX_SAFE_INTEGER y límites por dato; sin redondear |
| No autorización inferida | No propone min(Disponible Hoy, saldo), número de meses ni ahorro por abono sin liquidación y condiciones |
| Identidad | Moto/carro y referencias genéricas consultan hasta dos candidatos; si hay varios, pide identificar. Incluye VENCIDO. Una referencia explícita inexistente no cae en otra deuda recordada |
| Enrutamiento | Cuánto puedo abonar no se desvía al cupo de gasto; cuánto puedo invertir alcanza la rama de inversión. Persisten otras expresiones amplias por revisar, como me alcanza |
| Contexto | Una respuesta contextual verificada puede recordar solo foco/etiqueta/identidad. Fallo de ese metadato no cambia cifras ni produce una escritura financiera |
| C3 | Seis líneas, semáforo amarillo y una Acción. Cantidades formateadas, escenario diferenciado de obligación exigible; respuesta de error sanitizada |
| Conservación y aislamiento | CI autenticada: deuda vigente, seguimiento, tasa/cuota desconocidas, referencia ambigua/ajena/retirada, corrupción sintética y fotos de préstamos/cuentas/fuentes/outbox |

La selección preliminar y la relectura no certifican intención bajo cambios concurrentes de candidatos. No se ejecuta ningún abono por preguntar. La lectura comprueba estructura/importes, no acredita por sí sola integridad criptográfica del historial completo ni condiciones del acreedor. No se modifican deudas, movimientos, cuentas, índices, roles ni fuentes originales para consultar. Los cambios de tasa/estado/corrupción de pruebas son fixtures, no reparación o anulación de producción.

Quedan liquidación contractual exacta por fechas, plan de amortización/abonos con condiciones verificadas, resúmenes y cuentas por cobrar, expresiones restantes de intención, históricos y todos los gates operativos de #407. No declarar toda la asesoría financiera terminada ni desplegar parcialmente.
