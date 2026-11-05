# Resumen conversacional y totales registrados de préstamos

Dos bloques relacionados: (1) resumen del período sobre Home snapshot compensado; (2) totales acotados de cuentas por cobrar/deudas. Sustituyen las ramas respectivas de consultaPersonal. No modifican el servicio resumenLedgerPersonal: después de retirar consultaPersonal no se encontraron referencias directas a ese servicio en los JavaScript regulares del módulo. Se conserva el archivo; esto no acredita ausencia de consumidores dinámicos/externos. El resumen HTTP de finanzasPersonales.service todavía requiere revisión de lecturas, porcentajes y semántica.

## Resumen registrado

La consulta obtiene Home con un corte capturado y verifica COP, mismo corte, componentes enteros no negativos, coherencia de suma BigInt y hecho LEDGER_PERSONAL de alta confianza con igual importe/corte. Usa inicio de mes civil de Colombia a las 05:00 UTC y corte inclusivo. No incluye el resto del mes futuro. Distingue ingreso, cobro de préstamo, consumo, salida por gasto y pago de deuda según el contrato de Home. Flujo realizado = ingresos registrados + cobros registrados − gastos de caja registrados − pagos de deuda registrados.

La respuesta conserva hasta seis líneas y una Acción, explica el período y separa componentes. flujoLibreMinor=null y autorizaGasto=false: un neto positivo no prueba ahorro, liquidez conciliada o capacidad de gasto. Los campos de consumo y salidas pueden diferir por crédito. Se describe el ledger interpretado por Home, no un extracto bancario ni completitud histórica certificada. La auditoría de semántica de todas las fuentes antiguas/impactoCaja fuera de los flujos probados sigue pendiente.

## Totales de préstamos

Una transacción snapshot de solo lectura obtiene hasta 501 fuentes por dueño/dirección/estado ACTIVO o VENCIDO, con maxTimeMS de 5 s. Si excede 500, falla completo. No filtra saldo>0 en Mongo: comprueba también fuentes cero o negativas antes de excluir únicamente ceros válidos. Reutiliza exigirPrestamosPatrimonio para identidad, dueño, estados y principal/saldo exactos; valida cuota y etiquetas antes de sumar con BigInt y rango seguro. No redondea, limpia ni repara documentos.

Cuentas por cobrar registradas no se convierten en caja ni ingreso recibido. Deudas agregadas no son saldo exigible hoy. Solo publica total de cuotas mensuales si todas las fuentes pendientes tienen cuota positiva y periodicidad MENSUAL expresamente confirmada; de otro modo cuotasMinor=null. Las fuentes listadas conservan ID, concepto, contraparte, saldo y estado. Sin fuentes válidas pendientes, un listado completo devuelve cero conocido; un fallo devuelve null y completo=false.

| Aceptación | Validación |
| --- | --- |
| Fuente y exactitud del resumen | Igualdad con Home, cobro separado de ingreso, consumo de crédito separado de salida, pago de deuda, corrección sin reescribir original |
| Corte colombiano | Caso 1 de noviembre 03:00 UTC todavía pertenece al período iniciado el 1 de octubre 05:00 UTC; corte capturado una vez |
| Coherencia y fallos | Importes coercibles/decimales/negativos, suma fuera de rango, fórmula o evidencia/corte discordantes no dan cifras parciales |
| Lecturas acotadas | Límite 500+1, validación previa de cada fuente y rechazo de exceso; no recortar y presentar como total |
| Propiedad y cero | Otro dueño aislado; cero conocido solo tras lectura completa, fuente negativa no desaparece por filtro |
| Sesión | Apertura/lectura/commit/cierre fallidos descartan total; no realiza escrituras de coordinación |
| Cuotas | Falta de calendario/frecuencia/confirmación impide un falso total mensual, sin inventar vencimientos |
| Integración conversacional | Preguntas por cobrar y plurales de deuda van a totales; referencia a deuda individual mantiene su flujo. Una pregunta abierta ya no carga el resumen legacy sin necesidad |

Compatibilidad: RESUMEN conserva su tipo pero usa flujoRealizadoMinor; flujoLibreMinor pasa a null y no publica fondos/perfil/deuda legacy. CUENTAS_POR_COBRAR conserva totalMinor/cuentas y agrega completo/fuentes/corte; DEUDA conserva saldoMinor/cuotasMinor, con cuota desconocida null. No convertir null a cero en consumidores.

El corte de respuesta no es timestamp de commit de MongoDB ni reconstrucción de versiones históricas. No se certifica inmutabilidad criptográfica completa de préstamos/proyecciones. Quedan otros resúmenes/consumidores, progreso/obligaciones, planes contractuales, históricos, pendientes antiguos y coordinación de dispositivos, más gates de #407/custodio independiente/backup durable/restauración real/seguridad/compatibilidad. Sin despliegue parcial ni modificaciones a información real.
