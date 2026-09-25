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


## Libro canónico de caja

La Junta viva ya no reconstruye entradas y salidas confirmadas sumando directamente `Venta`, `Compra` y `Gasto`.

La fuente financiera operativa es `movimientos_caja`, implementada en:

- `core/finanzas/models/MovimientoCaja.js`
- `core/finanzas/caja.service.js`
- `intelligence/listeners/caja.listener.js`
- `shared/jobs/caja.job.js`

Cada asiento contiene empresa, sede, dirección, monto, origen, tipo de asiento, fecha de confirmación y clave de idempotencia.

Los asientos son inmutables. Si un pago deja de estar confirmado, GRUK crea una `REVERSION`; no borra ni reescribe el movimiento original.

### Idempotencia

El mismo evento puede recibirse más de una vez sin duplicar caja.

La clave usa origen, documento, tipo de asiento y versión temporal del documento. Además, antes de crear una confirmación GRUK verifica si ya existe una confirmación activa para ese origen.

### Duplicados entre documentos distintos

GRUK nunca deduplica Compra vs. Gasto por monto, fecha, proveedor o texto parecido.

Si dos documentos representan el mismo pago, deben compartir una `metadata.cajaReferencia` explícita. Solo entonces el libro puede tratar el segundo registro como la misma realidad económica.

### Reconciliación

Al iniciar la aplicación y luego cada hora, GRUK reconcilia el mes actual contra MongoDB.

La reconciliación también revisa documentos cuya `updatedAt` está dentro del periodo, aunque la fecha original de la compra o gasto sea anterior. Esto permite recuperar cambios de estado de pago que pudieron ocurrir después de la fecha original.

Si un evento se perdió por caída del proceso, la reconciliación reconstruye el asiento de forma idempotente y emite un único `CAJA_RECONCILIADA` al finalizar.

## Diagnóstico automático de expertos

La Junta viva ejecuta el motor experto nativo después de cambios empresariales relevantes.

Antes de generar opinión, GRUK incorpora evidencia determinística de caja de 24 horas en el reporte de Finanzas:

- entradas confirmadas;
- salidas confirmadas;
- flujo confirmado parcial;
- aclaración explícita de que no es saldo bancario.

Solo se persisten y muestran expertos con relevancia `ALTA` o `MEDIA`, además de Dirección.

Cada diagnóstico conserva:

- departamento;
- relevancia;
- respuesta;
- criterio profesional;
- evidencia utilizada;
- riesgos;
- datos faltantes;
- confianza;
- fecha de generación.

Esta capa es consultiva. Aunque la Junta detecte un problema, no crea órdenes ejecutables. El Cerebro conserva autoridad exclusiva para decidir.


## Tesorería real y proyección

GRUK separa tres conceptos que no deben confundirse:

1. flujo confirmado del periodo;
2. saldo disponible por cuentas configuradas;
3. proyección de obligaciones y cobros futuros.

### Cuentas de tesorería

`CuentaTesoreria` representa Caja, Banco, Billetera u Otra cuenta real.

Cada cuenta tiene:

- empresa y sede;
- saldo inicial confirmado;
- fecha/hora del saldo inicial;
- métodos de pago asociados;
- política de saldo negativo;
- auditoría de creador.

El saldo inicial no puede fecharse en el futuro.

Los movimientos posteriores se asignan automáticamente solo si existe una única cuenta compatible con método de pago y sede. Si existen cero o varias cuentas candidatas, el movimiento queda `SIN_ASIGNAR`.

### Confiabilidad

Tesorería usa:

- `SIN_CONFIGURAR`: no hay cuentas;
- `PARCIAL`: existen movimientos confirmados sin cuenta asignada;
- `COMPLETO`: saldo inicial y movimientos posteriores están trazados.

La Junta solo puede tratar `saldoDisponible` como hecho fuerte cuando el estado es `COMPLETO`.

### Transferencias internas

Una transferencia genera dos asientos atómicos:

- SALIDA en cuenta origen;
- ENTRADA en cuenta destino.

No cambia el flujo operativo total de la empresa.

La cuenta origen se bloquea dentro de la transacción para evitar gastar el mismo saldo en transferencias concurrentes.

### Vencimientos

Compra y Gasto admiten `fechaVencimientoPago`.

Venta pendiente admite `fechaVencimientoCobro`.

Los cobros esperados nunca se convierten en caja antes de confirmarse.

### Proyección 7/30 días

`tesoreriaProyeccion.service.js` calcula:

- obligaciones vencidas;
- obligaciones próximas 7 y 30 días;
- cobros esperados 7 y 30 días;
- próximo vencimiento;
- saldo después de obligaciones usando solo caja actual;
- escenario condicionado a cobrar todo lo esperado;
- promedio de salidas confirmadas de 30 días;
- días de cobertura sobre ese histórico.

Estados 7 días:

- `CUBIERTO_CON_CAJA_ACTUAL`
- `DEPENDE_DE_COBROS`
- `DEFICIT_AUN_COBRANDO_TODO`
- `SIN_SALDO_VERIFICABLE`

Si la proyección es COMPLETA y queda `DEFICIT_AUN_COBRANDO_TODO`, la Junta marca CRITICO y `requiereDecisionCerebro=true`.

Si depende de cobros, marca ATENCION pero no genera orden.

### Limitación explícita de pagos parciales

El modelo legacy de Compra admite `estadoPago=parcial`, pero no conserva todavía el monto pagado acumulado.

GRUK no inventa el saldo pendiente. Las compras parciales se excluyen del monto exacto proyectado y reducen la confiabilidad de la proyección a PARCIAL hasta modelar cuotas/pagos parciales correctamente.
