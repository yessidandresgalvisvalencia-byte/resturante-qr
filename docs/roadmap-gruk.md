# GRUK — Roadmap disciplinado

Fecha de referencia: 26 de septiembre de 2026.

Este documento separa capacidad actual, foco inmediato y arquitectura futura.

## GRUK HOY

Capacidades ya construidas o confirmadas en el repositorio:

- Empresa, Sede y Usuario.
- Restaurante y pedidos.
- Estados operacionales del pedido.
- Pagos y ventas vinculadas.
- Productos/servicios.
- Inventario y vencimientos.
- Compras y gastos.
- Libro canónico de caja.
- Cuentas de Tesorería y transferencias.
- Obligaciones registradas y recurrentes.
- Proyección de Tesorería 7/30 días.
- Reservas de caja.
- Cierre mensual y distribución del dueño.
- Retiros del dueño auditados.
- Neuronas funcionales.
- Junta viva consultiva.
- Cerebro con decisiones y aprobación humana.
- Memoria de KPI/decisiones.
- Eventos internos y jobs.
- RBAC y aislamiento por empresa en las rutas nuevas.

Esto no significa que todo el sistema legacy esté ya migrado al estándar objetivo.

## GRUK AHORA — foco obligatorio

La prioridad técnica es hacer impecable esta cadena:

PEDIDO
↓
VENTA
↓
PRODUCTO
↓
RECETA
↓
INSUMO
↓
INVENTARIO
↓
COSTO
↓
MARGEN
↓
CAJA

La prueba de calidad es poder responder, con evidencia:

> Vendiste esto, consumiste aproximadamente esto, te costó esto y te dejó esto.

Luego:

> Deberías tener X y físicamente tienes Y.

Luego:

> Existe una desviación.

Luego:

> Esta es la evidencia que soporta las causas candidatas.

No avanzar a proliferación de agentes hasta que esta cadena sea confiable.

## Definition of Done de la cadena económica

### Pedido → Venta

- Una venta debe poder rastrearse al pedido que la originó.
- No duplicar ventas por reintentos.
- Estado de pago inequívoco.
- Fecha de cobro distinta de fecha de venta cuando corresponda.

### Venta → Producto

- Cada línea vendida referencia una entidad canónica de producto.
- Precio y descuentos quedan congelados históricamente.

### Producto → Receta

- Producto preparado referencia receta/version de receta utilizada.
- Cambiar receta futura no reescribe costos históricos.

### Receta → Insumo

- Cantidades/unidades explícitas.
- Conversión de unidades controlada.
- No inferir ingredientes por nombre.

### Insumo → Inventario

- Movimientos de entrada/salida trazables.
- Consumo teórico por venta.
- Ajustes físicos separados del consumo teórico.
- Merma/desperdicio como eventos propios.

### Inventario → Costo

- Costo con fuente y fecha.
- Política de valoración explícita.
- Costo histórico congelado cuando se completa la venta.

### Costo → Margen

- Margen calculado solo con cobertura de costo confiable.
- Ventas sin costo confiable se separan, no contaminan el KPI.
- Expected vs Actual preparado para costo, porción y merma.

### Margen → Caja

- Utilidad no equivale a caja.
- Cobros y pagos confirmados gobiernan Caja.
- Obligaciones y reservas gobiernan caja libre.

## SIGUIENTE

Solo después de solidificar la cadena:

1. Compras + proveedores canónicos.
2. Inventario físico y reconciliación teórico vs real.
3. Event Log durable / outbox.
4. Process Telemetry del restaurante.
5. Expected vs Actual.
6. Exception Engine.
7. Evidence Layer navegable.
8. Action Layer reutilizable.
9. Policy Engine ampliado.
10. Un solo agente operacional.

Misión inicial de ese agente:

> Encuentra dónde este restaurante necesita atención económica u operacional.

Medir utilidad real antes de crear más agentes.

## DESPUÉS

- Operational + Economic Graph.
- Shared Business State más rico.
- Process Intelligence.
- Integraciones empresariales.
- Agentes especializados bajo Orchestrator.
- AI Economics.
- Autonomía controlada por proceso.
- Ontologías verticales adicionales.

## Experimento comercial prioritario

Mientras se desarrolla, conseguir restaurantes reales.

Preguntas que importan:

- ¿Pagan?
- ¿Lo usan semanal/diariamente?
- ¿Qué pantalla ignoran?
- ¿Qué función los hace volver?
- ¿Qué dato no tenían antes?
- ¿Qué decisión cambió?
- ¿Qué resultado económico produjo?
- ¿Permanecen?

La evidencia de tendencia tecnológica no sustituye product-market fit.

## Moat

No proteger la idea.

Acumular:

- clientes;
- contexto operacional;
- historial;
- integraciones;
- workflows;
- datos estructurados;
- decisiones;
- resultados;
- conocimiento vertical;
- marca;
- distribución.

El moat debe crecer con cada cliente y cada decisión medida.

## Regla de disciplina

Antes de abrir una nueva línea de producto:

1. demostrar valor en restaurante;
2. medir resultado económico;
3. comprobar repetibilidad;
4. estabilizar datos/evidencia;
5. recién entonces ampliar alcance.
