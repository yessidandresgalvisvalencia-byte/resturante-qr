# Visión GRUK 2026

## Definición

GRUK busca convertirse en una capa operacional e inteligente para empresas: construir una representación confiable de cómo funciona el negocio, conectar sus datos y procesos, detectar desviaciones y riesgos, explicar su impacto económico y ayudar a ejecutar acciones bajo reglas, permisos y supervisión humana, midiendo posteriormente sus resultados.

La fórmula rectora es:

`GRUK = CONTEXTO + PROCESOS + INTELIGENCIA + ACCIÓN + MEMORIA`

Debajo de todo: datos confiables.

Encima de todo: resultado económico medible.

## Principio de ejecución

La visión es de largo plazo. El producto inmediato sigue siendo vertical y concreto.

GRUK no intentará convertirse ahora en un ERP universal, un chatbot empresarial generalista ni una colección de agentes aislados.

El punto de entrada es restaurantes.

La prioridad técnica inmediata es hacer impecable esta cadena:

`PEDIDO → VENTA → PRODUCTO → RECETA → INSUMO → INVENTARIO → COSTO → MARGEN`

La pregunta mínima que GRUK debe responder sin ambigüedad es:

> Vendiste esto, consumiste aproximadamente esto, te costó esto y te dejó esto.

Después:

> Deberías tener X, pero tienes Y.

Después:

> Existe una desviación.

Después:

> Esta es la evidencia disponible sobre la causa.

## Arquitectura conceptual

### 1. System of Record

Registra correctamente lo ocurrido:

- pedido;
- venta;
- compra;
- inventario;
- pago;
- gasto;
- movimiento de caja;
- retiro;
- reserva;
- decisión.

### 2. System of Context

Conecta entidades y significado.

Ejemplo:

`Venta → Producto → Sede → Pedido → Costo → Margen`

GRUK no debe tratar cifras aisladas como contexto suficiente.

### 3. System of Process

Representa cómo ocurrió el trabajo.

Ejemplo restaurante:

`pedido creado → aceptado → cocina → listo → entregado → pagado`

El objetivo es medir tiempos, excepciones y desviaciones por etapa.

### 4. System of Intelligence

Detecta qué merece atención y por qué.

Primero se usan reglas determinísticas y datos estructurados.

Un modelo generativo es opcional y reemplazable; nunca es la fuente de verdad económica.

### 5. System of Action

Las capacidades empresariales deben ser reutilizables por humanos, automatizaciones y futuros agentes.

Ejemplos conceptuales:

- consultarStock;
- calcularCosto;
- consultarMargen;
- registrarDesperdicio;
- prepararCompra;
- transferirInventario;
- consultarProveedor.

La acción permanece estable aunque cambie el modo de interacción.

### 6. System of Learning

Conserva:

`problema → contexto → decisión → acción → resultado`

La memoria de decisiones y consecuencias es un activo estratégico de largo plazo.

## Orquestación antes que multiplicación de agentes

GRUK no debe crear decenas de agentes por departamento en esta etapa.

Eso puede reemplazar silos humanos por silos de agentes.

Ejemplo de conflicto:

- Inventario quiere comprar más para evitar faltantes.
- Finanzas quiere comprar menos para proteger caja.
- Compras quiere volumen para descuento.
- Margen quiere menor costo unitario.

Todos pueden tener razón localmente.

La decisión empresarial debe resolverse globalmente.

Por eso el Cerebro/Orquestador conserva autoridad sobre prioridades y órdenes.

## Objetivos, restricciones y trade-offs

GRUK debe conocer objetivos explícitos de la empresa.

Ejemplos:

- margen objetivo;
- punto de equilibrio;
- ticket objetivo;
- CAC máximo;
- empleados actuales;
- política de caja;
- reservas;
- prioridades de pago.

La ausencia de esos objetivos es preparación incompleta, no una alerta operativa.

GRUK no debe afirmar simplemente que “comprar es bueno” o “vender más es bueno”.

Debe expresar trade-offs:

> Comprar reduce riesgo de agotamiento, pero aumenta inventario y compromete caja.

## Expected vs Actual

Componente central futuro y progresivo:

- ventas esperadas vs reales;
- costo esperado vs real;
- margen esperado vs real;
- inventario teórico vs físico;
- tiempo esperado vs real;
- desperdicio esperado vs real.

Secuencia:

`desviación → evidencia → causa probable → impacto → acción → medición`

## Evidence Layer

Toda afirmación material debe poder rastrearse.

Ejemplo:

`proveedor → compra → ingrediente → receta → producto → costo → margen`

La inteligencia puede interpretar.

GRUK conserva la evidencia.

## Autonomía progresiva

Secuencia autorizada:

`OBSERVAR → EXPLICAR → RECOMENDAR → PREPARAR → PEDIR APROBACIÓN → ACTUAR CON LÍMITES → AUTONOMÍA CONTROLADA`

La autonomía se gana por proceso y por evidencia de confiabilidad.

No existe autonomía global por defecto.

## Policy Engine e identidad

Toda acción relevante debe conocer:

- identidad;
- rol;
- empresa;
- sede;
- permisos;
- límites;
- presupuesto;
- auditoría.

Roles actuales base:

- DUEÑO;
- ADMIN_SEDE;
- EMPLEADO.

Un agente futuro tendrá las mismas restricciones de identidad y permiso que una persona o servicio.

## AI Economics

La inteligencia tiene costo.

Orden preferido:

`regla determinística → cálculo local → modelo pequeño → modelo avanzado → humano`

Un stock igual a cero no requiere un LLM.

Una decisión compleja con demanda, inventario, proveedores, margen, caja e incertidumbre puede justificar inteligencia más costosa.

A futuro GRUK deberá medir costo de inteligencia versus valor económico producido.

## Integración

GRUK no necesita reemplazar todos los sistemas.

En empresas pequeñas puede ser system of record directo.

En empresas grandes puede conectarse a ERP, CRM, WMS, banco, nómina, facturación o IoT.

La visión es:

> Conéctalo a GRUK.

No:

> Borra todo y usa GRUK.

## Verticalización

El motor tecnológico puede compartirse.

La ontología operacional no.

Restaurante:

`receta → ingrediente → preparación → pedido`

Manufactura:

`BOM → materia prima → máquina → orden → calidad`

Logística:

`vehículo → conductor → ruta → paquete → entrega`

Construcción:

`proyecto → actividad → material → contratista → avance`

El foco actual permanece en restaurante.

## GRUK actual

Capacidades que ya existen o están implementadas en esta rama:

- Empresa, Sede y Usuario;
- pedidos y estados operativos;
- ventas y pagos;
- inventario;
- caja canónica;
- cuentas de Tesorería;
- obligaciones y proyección;
- neuronas determinísticas;
- Junta consultiva;
- Cerebro y órdenes;
- aprobación humana;
- memoria y auditoría;
- políticas de pago;
- reservas;
- distribución y retiros del dueño;
- inventario con búsqueda y filtros.

## Arquitectura objetivo, no capacidad actual

Todavía son evolución progresiva y no deben presentarse como producto terminado:

- economic graph completo;
- semantic layer general;
- process mining completo;
- process intelligence transversal;
- integration layer extensa;
- múltiples agentes autónomos;
- policy engine universal;
- AI economics automatizada;
- autonomía amplia;
- ontologías para múltiples industrias.

## Prioridad de producto

Antes de ampliar el alcance, profundizar restaurante.

Orden recomendado:

1. Pedido → Venta.
2. Venta → Producto.
3. Producto → Receta.
4. Receta → Insumo.
5. Insumo → Inventario.
6. Inventario → consumo teórico.
7. Consumo teórico → costo real/confiable.
8. Costo → margen.
9. Inventario teórico → inventario físico.
10. Desviación → evidencia.

Después:

1. compras y proveedores;
2. reconciliación física;
3. event log;
4. process telemetry;
5. expected vs actual;
6. exception engine;
7. evidence layer;
8. action layer;
9. permisos/policy;
10. un agente operacional único.

Ese agente tendría una misión inicial:

> Encuentra dónde este restaurante necesita atención económica u operacional.

## Disciplina comercial

El desarrollo debe avanzar acompañado de validación comercial real.

Preguntas obligatorias:

- ¿Pagan?
- ¿Lo usan?
- ¿Qué usan?
- ¿Qué ignoran?
- ¿Qué dolor los hace volver?
- ¿Qué información antes no tenían?
- ¿Qué resultado económico produce GRUK?
- ¿Permanecen?

La validación tecnológica no equivale a product-market fit.

## Moat

El activo defendible no es el modelo de IA.

Es la acumulación de:

- clientes;
- contexto operacional;
- datos estructurados;
- integraciones;
- workflows;
- procesos;
- decisiones;
- resultados;
- conocimiento vertical;
- distribución;
- marca.

Un competidor puede copiar una pantalla o usar el mismo LLM.

Es más difícil copiar años de contexto empresarial estructurado y decisiones con resultados medidos.

## Regla final

Cada nueva línea de código debe responder al menos una de estas preguntas:

1. ¿Mejora la confiabilidad del dato?
2. ¿Conecta mejor la cadena económica del restaurante?
3. ¿Hace observable un proceso?
4. ¿Reduce una decisión ambigua?
5. ¿Habilita una acción segura?
6. ¿Permite medir el resultado?
7. ¿Acerca GRUK a un problema que un restaurante pagaría por resolver?

Si no responde ninguna, probablemente no es prioridad.
