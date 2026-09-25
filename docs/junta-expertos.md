# Junta Directiva GRUK — motor experto nativo y estado vivo

## Objetivo

La Junta Directiva es consultiva. Finanzas, Ventas, Marketing, Operaciones, Gente y Dirección deliberan usando lógica propia de GRUK, reportes determinísticos de neuronas, hechos humanos y contexto conversacional persistido.

La Junta también mantiene un estado empresarial vivo: observa movimientos confirmados, actualiza su diagnóstico y conserva cómo cambió la lectura anterior.

La Junta no genera órdenes ejecutables. Esa autoridad sigue reservada al Cerebro GRUK.

## Dependencias externas

Ninguna.

La Junta no requiere OpenAI, API keys, modelos remotos ni proveedores de IA externos. El motor no realiza llamadas de red para generar respuestas.

## Deliberación conversacional

1. Clasifica intención y tema.
2. Extrae hechos humanos concretos, por ejemplo ventas, gastos, salidas de personal, quejas, quiebres de inventario o cambios de precio.
3. Mantiene continuidad entre turnos y enriquece el mismo caso cuando el usuario aporta nuevos datos.
4. Cruza los hechos con los KPI y hallazgos reales de las neuronas.
5. Cada experto declara evidencia, criterio, riesgos, objeciones, acuerdos, datos faltantes, confianza y relevancia.
6. Los expertos sin aporte material pueden declarar relevancia NINGUNA y no se muestran como ruido en la interfaz.
7. Dirección sintetiza sin emitir órdenes.
8. El Cerebro conserva autoridad exclusiva para decidir y mandar órdenes.

## Junta en vivo

La Junta escucha el bus de eventos de GRUK y recalcula automáticamente su estado ante:

- `VENTA_COMPLETADA`
- `GASTO_REGISTRADO`
- `GASTO_PAGO_ACTUALIZADO`
- `COMPRA_REGISTRADA`
- `COMPRA_PAGO_ACTUALIZADO`
- `CICLO_INTELIGENCIA_COMPLETADO`

Mantiene dos ventanas: últimas 24 horas y mes actual. Conserva hasta 30 lecturas recientes y explica cuánto cambió el flujo confirmado parcial desde la lectura anterior.

### Reglas de dinero

GRUK distingue registro económico de movimiento confirmado de caja:

- Venta con estado pagada: entrada confirmada.
- Compra pagada: salida confirmada.
- Compra pendiente/parcial: salida no confirmada.
- Gasto pagado: salida confirmada.
- Gasto pendiente, desconocido o histórico sin estado de pago: salida no confirmada.

`flujoConfirmadoParcial` = ventas pagadas - compras pagadas - gastos pagados.

Este indicador **no es saldo bancario ni caja total**. Todavía no incorpora automáticamente todos los conceptos posibles, como saldo inicial de bancos, nómina, impuestos, deuda o movimientos externos que no estén registrados en GRUK.

Un flujo confirmado parcial negativo genera estado ATENCION, pero no permite afirmar por sí solo que la empresa tenga caja negativa.

## Diagnóstico y Cerebro

La Junta puede marcar NORMAL, ATENCION o CRITICO.

- Un KPI de neurona CRITICO marca el diagnóstico vivo como CRITICO y señala que se requiere decisión del Cerebro.
- Un flujo confirmado parcial negativo puede marcar ATENCION.
- La Junta no crea órdenes por sí misma.
- Las órdenes continúan naciendo exclusivamente en el Cerebro y mantienen aprobación humana según el nivel de automatización vigente.

## Seguridad

Todo se ejecuta dentro de GRUK. No se envían datos de empresa, usuarios, decisiones, KPIs ni conversaciones a terceros.

`GET /api/junta/viva` utiliza el mismo `auth + empresaId + roleCheck(DUEÑO, ADMIN_SEDE)` de la Junta.

DUEÑO ve el estado agregado de su empresa. ADMIN_SEDE solo ve movimientos de su sede.

Gastos y compras validan la sede contra el tenant; un ADMIN_SEDE no puede crear, consultar, anular o cambiar el pago de movimientos de otra sede.

La interfaz consulta el estado vivo mediante HTTP autenticado. No se publican datos financieros sobre el Socket.IO legacy porque ese canal todavía no implementa aislamiento seguro por tenant.

## Compatibilidad

Las sesiones nuevas se guardan como `EXPERTO_GRUK`.

El tipo histórico `EXPERTO_IA` se conserva únicamente para leer sesiones antiguas.

Los gastos históricos que no tienen `estadoPago` son tratados como `desconocido` a efectos de caja: nunca se descuentan del flujo confirmado hasta contar con evidencia de pago.
