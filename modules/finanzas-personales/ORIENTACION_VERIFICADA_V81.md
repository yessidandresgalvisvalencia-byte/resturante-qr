# Orientación general, planificación e inversión

Tres ramas de consultaPersonal usan orientacionVerificadaPersonal: orientación general de ahorro/inversión/finanzas, planificación de vivienda/seguros/retiro/presupuesto e intención residual de inversión. Conservan los tipos de respuesta. Dejan de convertir disponibleHoyMinor ausente a cero mediante Number, || o Math.max, y dejan de consultar un resumen alternativo para inversión.

La observación C2 se comparte con Disponible Hoy conversacional mediante disponibleConversacionalPersonal.observar: dueño válido, corte capturado, Home snapshot, conciliación/aptitud explícitas, listas de bloqueos completas, próximo ingreso positivo de fecha civil futura y prueba/importes/fórmula/GMF coherentes. No se amplía ni se relaja el validador anterior. Una excepción produce observación no verificable sin detalles internos ni cantidades parciales.

| Criterio | Comportamiento |
| --- | --- |
| Cifra conocida | disponibleMinor conserva exactamente el límite verificado de salidas totales; disponibleConocido=true |
| Falta evidencia | disponibleMinor=null y disponibleConocido=false; nunca sustituye ausencia por cero o perfil |
| Cero y rojo | Cero conocido se distingue de ausencia; rojo explica brecha actual calculada por C2, sin inventar nueva meta de ingresos |
| Capacidad de inversión/ahorro | montoInvertibleMinor=null, montoAhorrableMinor=null, aptoParaInversion=false y aptoParaAhorro=false aun con Disponible Hoy positivo |
| Explicación C3 | Hasta seis líneas, semáforo y una Acción; formatea importes validados sin sumar, calcular intereses ni asignar capital |
| Decisión pendiente | Objetivo, fecha y condiciones no se inventan. No selecciona productos ni proyecta pensiones/rendimientos; se conserva la distinción entre orientación general y recomendación personal |
| Integración y fallos | Misma observación para las tres ramas; error, corte inválido, falta de horizonte, saldo/obligación sin conciliar, importe coercible o evidencia discrepante no publican otro cupo |
| Sin escritura financiera | Consultar conserva cuentas, calendario, préstamos, transacciones y outbox; la corrección de ingreso se refleja sin reescribir su original |

La respuesta ya no declara todo Disponible Hoy como capital invertible: incluye las salidas totales previstas, y por sí solo no acredita un presupuesto de aportes, perfil de riesgo ni capacidad para bloquear liquidez. Obtener los datos requeridos no equivale automáticamente a aprobar una inversión: la evaluación completa de aportes/productos queda pendiente.

Alcance acotado: no se certifican las otras ramas de deuda contextual/comparación de abonos, progreso, obligaciones, resumen o cuentas por cobrar. Persisten cálculos aproximados/coerciones fuera de estas tres ramas, incluida estimación de interés y número de pagos; requieren C2 exacta y evidencia. El enrutamiento amplio de cuánto puedo aún prioriza Disponible Hoy y debe revisarse sin confundir precio, abono o aporte con cupo. La lectura de Home es snapshot, no autorización transaccional de gasto futuro ni evidencia de históricos completos. Gates de #407, dispositivo físico y operación real siguen pendientes; sin despliegue parcial.
