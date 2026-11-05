# Simulación conversacional exacta — contrato 2

Un bloque integrado: clasificación acotada de condiciones explícitas, cálculo determinístico BigInt y respuesta breve en español. La intención completa o incompleta se resuelve antes de consultar Home, historial o escribir contexto de zapatos. No crea compra, deuda, pago, ingreso ni evento financiero; no consulta ni aprueba capacidad de pago. Un precio aislado puede leer contexto propio existente, pero exige escenario completo y no reactiva las fórmulas antiguas.

## Criterios de aceptación

| Caso | Resultado |
| --- | --- |
| «Quiero comprar zapatos que valen 280 mil en 2 cuotas al 4%» | Pendiente: no elige método ni cargos; no muestra cuota |
| Agregar «una sola vez sobre cada cuota base sin cargos» | Interés único 11200.00; total 291200.00; dos cuotas 145600.00 |
| «simula precio 1000000 en 12 cuotas al 1,9% mensual sobre saldo sin cargos desembolso 2026-01-31 primer pago 2026-02-28» | Delega al motor HTTP exacto; total 1127757.91, primera 93979.83, última 93979.78; calendario con fin de mes |
| Método único frente a mensual contradictorios; precios/tasas múltiples, dinero con fracción o exponente | Pendiente/revisión, sin resultado parcial ni cuota |
| Cargos/calendario requeridos ausentes, plazo no representable o costo inicial mayor que precio | Pendiente, sin inventar cero ni plazo |
| «valen 280 mil» con compra antigua recordada | No aplica tasa ni cuota heredadas; exige condiciones completas |
| Escenario completo repetido por dos usuarios | Mismo resultado de solicitud pública, sin consultar datos financieros ni compartir contexto privado |
| Fallo de representación | No se autoriza crédito ni convierte desconocidos en cero |

## Contratos de cálculo y clasificación

simularCuotas exige precio COP entero seguro, numeroCuotas entero 1–360, tasaPct decimal (texto o número cuya representación sea exacta hasta seis posiciones), metodo explícito y cargosIniciales COP entero no negativo menor que precio. Rechaza claves extra y coerciones monetarias. SOBRE_CUOTA_BASE ya no es default: significa porcentaje único aplicado al capital completo, redondeado una vez al centavo y luego repartido en cuotas; el residuo va al último pago. No afirma que un comercio redondee cada interés individual del mismo modo. Cargos iniciales se pagan aparte al inicio, no se financian. Costo total incluye cuotas y cargos.

SALDO_DECRECIENTE significa cuota fija con tasa mensual constante, no amortización fija de capital. Reutiliza simulacionCreditoExactaPersonal sin otra fórmula: fechas obligatorias, primer período mensual completo y último pago ajustado. Conserva su límite de representabilidad. Porcentaje único no inventa vencimientos: calendario=null si no se declararon fechas; si se declaran, ambas deben ser válidas y primer pago posterior al desembolso. No equivale a un calendario completo de cuotas futuras en ese método.

Todos los cálculos monetarios y repartos usan BigInt centavos; cuotas/total/intereses son texto decimal con dos posiciones. Precio se extrae con BigInt y solo se convierte a entero COP Number después de comprobar rango seguro, sin producto monetario flotante. Clasificador reconoce un subconjunto explícito: etiquetas valen/cuesta/precio/comprar por; enteros o miles con puntos, unidades mil/luca/palo; «en/a N cuotas» y porcentaje explícito. No usa IA para sumar ni inferir tasa cero, cargos cero, método o fechas. La ausencia de reconocimiento exige aclarar el escenario, no reinterpretarlo como hecho financiero. No certifica comprensión completa de lenguaje natural, costos contractuales, impuestos/seguros o tasa legal.

La respuesta es de hasta seis líneas, semáforo amarillo y una acción; conserva centavos al formatear sin Number. cubrePrimeraCuota y capacidadMensual son null, autorizaCredito/creaDeuda false. Se retira del flujo la comparación antigua de primera cuota con Home parcial y las dos fórmulas Number del contexto de zapatos. riesgoCuotasMaster queda sin referencia directa en JavaScript regular del módulo salvo su propio archivo; se conserva para revisar usos dinámicos/externos, no se certifica su contrato ni se elimina por cosmética.

## Evidencia y límites

Siete casos nuevos del módulo y cuatro regresiones del simulador cubren precisión, cargos, calendario, formato, ambigüedad, tasas exponenciales, grandes importes, desconocidos, ausencia de I/O de simulación y precio aislado con contexto. Vector independiente Python Decimal con precisión 90 y HALF_UP: 280000 COP al 4% mensual durante dos meses → cuota 148454.90 y total 296909.80; interés único al 4% produce total 291200.00. El primer valor esperado escrito a mano en el test se corrigió contrastando ese vector, sin modificar el motor para satisfacerlo.

Integración MongoDB autenticada debe comparar todas las colecciones antes/después de solicitudes completas, repetidas, ambiguas, mensuales y precio aislado; incluye contexto de zapatos sintético anterior y dos propietarios. No se presenta esta consulta pura como prueba de concurrencia de escrituras ni nuevo end-to-end JWT de producción. Sin cambios de modelos, índices, roles, backup o datos reales.

Compatibilidad: contratos previos que suponían método/cargos, devolvían Number calculado o precioMinor=precio*100 cambian a texto COP y pendiente explícito. Revisar consumidores externos/dinámicos y dispositivos antes de liberar. Próximo bloque: integrar evaluación de crédito con escenario contractual y liquidez verificables; plan, progreso/obligaciones e históricos aún pendientes. #407, custodio independiente real, backup durable/retención/acceso y restauración operativa/RPO-RTO, seguridad/roles/índices reales y aceptación final siguen abiertos. Sin merge ni despliegue parcial.
