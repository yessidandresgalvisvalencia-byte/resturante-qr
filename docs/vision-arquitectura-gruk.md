# GRUK — Visión y arquitectura rectora

Fecha de referencia: 2026-09-26.

## 1. Definición

GRUK no es un ERP gigante, un chatbot empresarial ni una colección de agentes.

GRUK busca convertirse en una capa operacional e inteligente para empresas que:

1. construye una representación confiable de cómo funciona el negocio;
2. conecta datos, entidades, procesos y decisiones;
3. detecta desviaciones, riesgos y oportunidades;
4. explica por qué importan con evidencia trazable;
5. prepara o ejecuta acciones bajo políticas, permisos y supervisión humana;
6. mide lo ocurrido después;
7. conserva memoria de decisiones y resultados.

Fórmula rectora:

**GRUK = CONTEXTO + PROCESOS + INTELIGENCIA + ACCIÓN + MEMORIA**

Debajo de todo: datos confiables.

Encima de todo: resultado económico medible.

El punto de entrada comercial y técnico sigue siendo restaurantes.

## 2. Bucle operativo

GRUK debe converger hacia este ciclo:

**ENTENDER → DETECTAR → EXPLICAR → DECIDIR → ACTUAR → MEDIR → APRENDER**

Cada nueva capacidad debe indicar en qué parte del ciclo vive y qué evidencia consume.

## 3. Sistemas conceptuales

### 3.1 System of Record

Pregunta: **¿qué ocurrió?**

Responsabilidad:

- pedidos;
- ventas;
- pagos;
- compras;
- movimientos de inventario;
- gastos;
- movimientos de caja;
- usuarios, sedes y responsables.

Regla: una capa inteligente nunca debe corregir o inventar la realidad transaccional.

### 3.2 System of Context

Pregunta: **¿qué significa lo que ocurrió?**

Debe relacionar entidades:

- Empresa;
- Sede;
- Usuario;
- Cliente;
- Proveedor;
- Pedido;
- Venta;
- Producto;
- Receta;
- Insumo;
- Inventario;
- Compra;
- Pago;
- Cuenta de Tesorería.

Ejemplo objetivo:

**Venta X → Producto Y → Pedido W → Sede Z**

### 3.3 System of Process

Pregunta: **¿cómo ocurrió?**

Debe poder reconstruir procesos y tiempos:

**pedido creado → aceptado → cocina → listo → entregado → pagado**

El propósito no es dibujar workflows, sino medir duración, excepciones, cuellos de botella y diferencias entre sedes.

### 3.4 System of Intelligence

Pregunta: **¿qué merece atención y por qué?**

La inteligencia debe trabajar sobre:

- excepciones;
- desviaciones;
- riesgos;
- oportunidades;
- expected vs actual;
- impacto económico;
- confiabilidad de datos.

Regla: determinismo primero. Un LLM no debe usarse para descubrir un hecho que Node puede calcular de forma verificable.

### 3.5 System of Action

Pregunta: **¿qué puede hacerse de forma segura?**

Las acciones deben ser capacidades empresariales reutilizables, no funciones especiales para IA.

Ejemplos conceptuales:

- consultarStock();
- calcularCosto();
- consultarMargen();
- registrarDesperdicio();
- prepararCompra();
- transferirInventario();
- consultarProveedor();
- registrarPago();
- registrarRetiroDueno();

El mismo servicio debe servir para botón humano, API, automatización o agente.

### 3.6 System of Learning

Pregunta: **¿funcionó?**

Cada decisión relevante debe poder conservar:

**problema → contexto → alternativas → recomendación → decisión humana → acción → resultado**

La memoria de decisiones y consecuencias es un activo estratégico, pero solo si la evidencia de entrada y resultado es confiable.

## 4. Arquitectura objetivo

La secuencia conceptual de largo plazo es:

```text
SISTEMAS / OPERACIÓN REAL
          ↓
SYSTEM OF RECORD
          ↓
ENTITY RESOLUTION
          ↓
SEMANTIC LAYER
          ↓
OPERATIONAL + ECONOMIC GRAPH
          ↓
PROCESS MODEL
          ↓
SHARED BUSINESS STATE
          ↓
EVENT / PROCESS TELEMETRY
          ↓
EXCEPTION + RISK ENGINE
          ↓
EVIDENCE LAYER
          ↓
GRUK ORCHESTRATOR
          ↓
INTELLIGENCE / AGENTS
          ↓
POLICY + PERMISSIONS
          ↓
ACTION LAYER
          ↓
RESULTADO
          ↓
DECISION LOG
          ↓
MEDICIÓN ECONÓMICA
```

Esta lista es arquitectura objetivo. No implica que cada capa exista hoy como producto terminado.

## 5. El activo estratégico

El moat de GRUK no debe ser un modelo fundacional propio.

GRUK debe ser model-agnostic.

El activo que debemos acumular es:

- contexto operacional estructurado;
- relaciones entre entidades;
- procesos;
- reglas;
- permisos;
- acciones;
- historial;
- decisiones;
- resultados;
- conocimiento vertical;
- integraciones;
- distribución y clientes.

Un modelo mejor debe hacer a GRUK mejor, no obsoleto.

## 6. Orquestador antes que enjambre de agentes

No construir 30 agentes ahora.

Muchos agentes funcionales pueden recrear los mismos silos que queremos eliminar.

Ejemplo de conflicto:

- Inventario quiere más stock.
- Finanzas quiere conservar caja.
- Compras quiere volumen para descuento.
- Margen quiere menor costo.

Todos pueden tener razón localmente.

El **GRUK Orchestrator / Cerebro** debe resolver globalmente usando objetivos, restricciones, evidencia y políticas.

Los expertos/neuronas reportan.

El Cerebro decide.

La acción permanece bajo permisos.

## 7. Objetivos, restricciones y trade-offs

GRUK no puede “optimizar” sin saber qué quiere la empresa.

Debe representar progresivamente:

- objetivos;
- límites;
- prioridades;
- horizonte temporal;
- restricciones de caja;
- políticas del dueño;
- tolerancias operativas.

La respuesta correcta no es:

> Comprar es bueno.

Debe ser:

> Comprar reduce riesgo de agotamiento, pero aumenta inventario y compromete caja.

## 8. Expected vs Actual

Debe convertirse en un patrón transversal:

- ventas esperadas vs reales;
- costo esperado vs real;
- margen esperado vs real;
- inventario teórico vs físico;
- tiempo esperado vs real;
- desperdicio esperado vs real.

Cadena:

**desviación → evidencia → causa posible → impacto → acción → resultado**

Nunca declarar causa sin evidencia suficiente.

## 9. Evidence Layer

Toda conclusión crítica debe poder responder:

**¿cómo lo sabes?**

Ejemplo objetivo:

**proveedor → compra → precio → ingrediente → receta → producto → costo → margen**

La IA puede interpretar.

GRUK debe conservar la trazabilidad.

Esto es obligatorio para dinero, compras, inventario, pagos, precios y decisiones de riesgo.

## 10. Autonomía progresiva

Escalera oficial:

1. OBSERVAR
2. EXPLICAR
3. RECOMENDAR
4. PREPARAR
5. PEDIR APROBACIÓN
6. ACTUAR CON LÍMITES
7. AUTONOMÍA CONTROLADA

El sistema actual debe permanecer en nivel 2 para acciones financieras sensibles: propone y requiere aprobación.

Ningún proceso sube de nivel por moda. Sube cuando existe evidencia suficiente de confiabilidad y control.

## 11. Policy Engine e identidad

Todo humano o agente debe tener:

- identidad;
- empresa;
- sede;
- rol;
- permisos;
- límites;
- presupuesto;
- acciones permitidas;
- auditoría.

Ejemplo:

Un agente de inventario puede consultar y preparar.

No puede aprobar compras salvo política explícita.

## 12. Process Intelligence

GRUK debe evolucionar desde eventos aislados hacia telemetría de procesos.

Objetivo:

- reconstruir flujo;
- medir tiempos;
- detectar excepciones;
- comparar sedes;
- localizar etapas que crean costo o retraso.

No construir minería de procesos genérica antes de tener eventos confiables del flujo de restaurante.

## 13. Integration Layer

GRUK no necesita reemplazar todos los sistemas.

En pequeñas empresas puede proveer operación directa.

En compañías mayores debe poder actuar como capa de contexto/coordinación sobre:

- ERP;
- CRM;
- WMS;
- bancos;
- nómina;
- facturación;
- IoT;
- software vertical.

Principio comercial futuro:

**No necesariamente reemplaces tu sistema. Conéctalo a GRUK.**

## 14. Verticalización

El motor puede ser común.

La ontología operacional no.

Restaurante:

**receta → ingrediente → preparación → pedido**

Manufactura:

**BOM → materia prima → máquina → orden → calidad**

Logística:

**vehículo → conductor → ruta → paquete → entrega**

Construcción:

**proyecto → actividad → material → contratista → avance**

No copiar una vertical cambiando el logo.

## 15. AI Economics

La inteligencia tiene costo.

Jerarquía deseada:

**regla determinista → modelo pequeño → modelo avanzado → humano**

Usar el nivel mínimo que resuelva el problema con suficiente calidad y seguridad.

Ejemplo:

`stock === 0` no necesita LLM.

Un conflicto de demanda + proveedores + margen + inventario + caja puede justificar inteligencia más avanzada.

En el futuro GRUK debe medir:

**costo de inteligencia vs valor económico producido**

## 16. Qué no construir ahora

- No 30 agentes.
- No diez industrias simultáneas.
- No foundation model propio.
- No 100 integraciones antes de PMF.
- No automatización de procesos no entendidos.
- No LLM con acceso indiscriminado a base de datos.
- No módulos porque “suenan interesantes”.
- No vender arquitectura futura como capacidad actual.

## 17. GRUK actual vs arquitectura objetivo

### Existe actualmente en el repositorio

Capacidades confirmadas o en implementación validada:

- Empresa / Sede / Usuario;
- pedidos y estados operacionales existentes;
- ventas y pagos;
- inventario y vencimientos;
- compras y gastos;
- caja canónica;
- cuentas de Tesorería;
- obligaciones registradas y recurrentes;
- cobertura de caja;
- Junta viva;
- neuronas funcionales;
- Cerebro y órdenes con aprobación;
- memoria de KPI;
- política de pagos;
- reservas de caja;
- distribución y retiros del dueño;
- auditoría;
- eventos internos;
- filtros empresariales de inventario.

### Arquitectura objetivo, no declarar como terminada

- Entity Resolution general;
- Semantic Layer completa;
- Economic Graph;
- Process Model genérico;
- Process Intelligence madura;
- Exception Engine transversal;
- Evidence Layer formal para todas las entidades;
- Action Layer unificada en todo el producto;
- Policy Engine general;
- integración multi-ERP;
- agentes autónomos especializados;
- AI Economics;
- autonomía multinivel madura.

Regla de comunicación: no confundir dirección arquitectónica con producto entregado.

## 18. Prioridad técnica inmediata

El objetivo técnico inmediato es hacer impecable esta cadena:

**PEDIDO → VENTA → PRODUCTO → RECETA → INSUMO → INVENTARIO → COSTO → MARGEN**

GRUK debe poder demostrar:

> Vendiste esto, consumiste aproximadamente esto, te costó esto y te dejó esto.

Después:

> Deberías tener X, pero tienes Y.

Después:

> Existe una desviación.

Después:

> Esta evidencia apunta a estas causas posibles.

No saltar a autonomía avanzada antes de cerrar esta cadena.

## 19. Secuencia posterior

Después de cerrar la cadena económica:

1. compras + proveedores;
2. inventario físico y reconciliación;
3. Event Log durable;
4. Process Telemetry;
5. Expected vs Actual;
6. Exception Engine;
7. Evidence Layer;
8. Action Layer;
9. Policy/Permissions general;
10. un solo agente operacional.

Misión inicial del agente:

> Encuentra dónde este restaurante necesita atención económica u operacional.

Medir si produce hallazgos útiles antes de crear más agentes.

## 20. Disciplina comercial

Desarrollo y ventas deben avanzar en paralelo.

Preguntas que debemos responder con restaurantes reales:

- ¿Pagan?
- ¿Lo usan?
- ¿Qué ignoran?
- ¿Qué función los hace volver?
- ¿Qué dolor tiene valor económico?
- ¿Qué dato no tienen hoy?
- ¿Qué resultado medible produce GRUK?
- ¿Permanecen?

La evidencia de tendencia tecnológica no reemplaza evidencia de product-market fit.

## 21. Criterio para aceptar nuevas features

Una feature nueva debe responder al menos una:

1. ¿Hace más confiable la cadena económica principal?
2. ¿Reduce una incertidumbre empresarial importante?
3. ¿Conecta contexto que hoy está fragmentado?
4. ¿Habilita una acción segura y medible?
5. ¿Mejora trazabilidad/evidencia?
6. ¿Produce aprendizaje reusable?
7. ¿Ayuda a demostrar valor a restaurantes reales?

Si no responde ninguna, no debe entrar al roadmap inmediato.

## 22. North Star

Visión de largo plazo:

> GRUK construye una representación viva de la empresa, conecta operación y contexto, detecta lo que importa y transforma evidencia en decisiones y acciones controladas cuyos resultados pueden medirse y aprenderse.

Propuesta comercial inicial:

> GRUK ayuda a restaurantes a conectar su operación para entender qué está pasando con sus ventas, inventario, costos y margen.

La visión puede ser enorme.

El alcance actual debe ser pequeño, verificable y económicamente útil.
