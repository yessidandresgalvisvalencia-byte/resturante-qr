# Simulador de crédito exacto — contrato 2

POST /creditos/simular es una consulta autenticada sin persistencia. No crea deuda, desembolso, pago, ingreso ni auditoría financiera; repetirla no afecta caja ni patrimonio. Tampoco autoriza crédito ni calcula capacidad de pago. Usa cuota fija mensual, tasa constante, períodos completos y último pago ajustado al saldo exacto restante.

## Entrada completa y explícita

Se requieren exactamente seis campos; no se descartan claves desconocidas ni se convierten textos de dinero a números.

| Campo | Contrato |
| --- | --- |
| capital | Número JSON entero COP positivo y seguro; no se aceptan fracciones ni strings |
| tasaMensualPct | Texto decimal sin exponente, hasta seis decimales, entre 0 y 100. Por compatibilidad admite número si su representación decimal cumple lo mismo; 0.1+0.2 se rechaza por precisión no declarada |
| meses | Número entero de 1 a 600 |
| cargosIniciales | Número entero COP no negativo, menor que capital; cero debe declararse. Se paga al inicio y no se financia |
| fechaDesembolso | Día civil YYYY-MM-DD desde 1900, sin fecha/hora inferida |
| fechaPrimerPago | Debe ser el mes siguiente al desembolso, conservando su día o ajustando al último día válido |

El calendario conserva el día original del desembolso, por ejemplo 31 enero → 28 febrero → 31 marzo. Las fechas civiles se interpretan en Colombia; no se usa UTC para adelantar el día. Se permiten fechas futuras porque es un escenario hipotético sin registrar operaciones. No hay prorrateo diario ni primer período irregular; esos contratos requieren otro modelo y se rechazan aquí. No se consulta información de otros usuarios.

## Exactitud y semántica

Capital y cargos se convierten a centavos BigInt, nunca float monetario. Para r = tasa/100, la cuota teórica es P·r·(1+r)^n / ((1+r)^n−1); con tasa cero es P/n. Numerador/denominador y potencias enteros exactos; cuota e interés de cada período se redondean a centavo por mitad hacia arriba. La última cuota paga saldo más interés de ese período. La suma de amortizaciones debe igualar capital; cuotas = capital + intereses y costoTotal = cuotas + cargos iniciales.

Una cuota redondeada que no amortiza, un plazo que liquida antes de la última cuota o cuyo pago queda en cero se rechazan 422; no se inventa un nuevo plazo, una cuota mínima o interés omitido. Esto puede suceder con capital pequeño/plazo largo o tasa alta/plazo largo. El ajuste final está visible; no se promete una última cuota idéntica a la ordinaria. La tasa efectiva anual es solo (1+r)^12−1, con seis decimales y redondeo explícito; no incluye cargos ni equivale a costo efectivo contractual o certificación legal.

Todos los importes de salida son **texto decimal COP con dos posiciones**, incluidos los nombres anteriores cuotaMensual/costoTotal/interesesEstimados. Hay tabla completa con saldo inicial, interés, amortización, pago y saldo final. No se convierten a Number aunque superen su rango seguro. Desembolso neto = capital − cargos; costoTotal incluye capital devuelto, intereses modelados y cargos declarados. No certifica seguros, impuestos, costos omitidos, oferta bancaria, tasa legal ni capacidad de pago.

## Aceptación y compatibilidad

- Vectores: 1000 COP al 10% durante dos meses y cargo 5 → cuota 576.19, intereses 152.38 y costo 1157.38; tasa cero 1 COP/3 → 0.33, 0.33, 0.34.
- Vector independiente con Python Decimal, precisión 90 y ROUND_HALF_UP: 1000000 COP al 1.9% durante 12 meses sin cargos → cuota 93979.83, última 93979.78, intereses 127757.91, total 1127757.91.
- Matriz reconcilia saldos y sumas exactas, montos grandes, años bisiestos, fin de mes; casos no representables se rechazan sin cambiar el escenario.
- HTTP real con Express prueba sesión requerida, caché privada/no-store, entrada completa, dueño no aceptado del cuerpo y error interno sanitizado sin resultado parcial. Es identidad sintética de prueba; no se presenta como nuevo ensayo end-to-end de JWT/entitlement de producción.
- CI MongoDB autenticado compara todas las colecciones antes/después de ocho consultas repetidas y rechazos. No acredita concurrencia de escrituras financieras: esta operación no escribe.

La ruta conserva middleware personalAuth/entitlement; el handler exige sesión y valida cuerpo original completo, sin stripUnknown/coerción Joi. No se observó llamada directa del frontend personal a /creditos/simular; consumidores externos/dinámicos requieren revisión. El contrato anterior de tres campos ahora devuelve 422: cliente debe enviar fechas/cargos, leer texto decimal y mostrar tabla/última cuota. No desplegar sin aceptación de consumidores/dispositivos. /creditos/evaluar mantiene estado pendiente; integrar condiciones contractuales/calendario/Disponible Hoy sin convertir flujo registrado en capacidad es el siguiente bloque. No cambia modelos, roles, índices, backup ni datos reales. #407 y aceptación operativa siguen abiertos.
