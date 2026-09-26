# GRUK — Visión y arquitectura objetivo

Fecha de referencia: 26 de septiembre de 2026.

## Definición

GRUK busca convertirse en una capa operacional e inteligente para empresas: construir una representación confiable de cómo funciona el negocio, conectar sus datos y procesos, detectar desviaciones y riesgos, explicar su impacto económico y ayudar a ejecutar acciones bajo reglas, permisos y supervisión humana, midiendo posteriormente sus resultados.

Comercialmente, el punto de entrada es más pequeño:

> GRUK ayuda a restaurantes a conectar su operación para entender qué está pasando con sus ventas, inventario, costos y margen.

La visión de largo plazo no autoriza a construir todo ahora.

## Fórmula

GRUK = CONTEXTO + PROCESOS + INTELIGENCIA + ACCIÓN + MEMORIA

- CONTEXTO: qué está pasando y qué significa.
- PROCESOS: cómo está ocurriendo.
- INTELIGENCIA: qué importa y por qué.
- ACCIÓN: qué puede hacerse de forma segura.
- MEMORIA: qué hicimos y qué resultado produjo.

Debajo de todo: datos confiables.

Encima de todo: resultado económico medible.

## Ciclo empresarial

ENTENDER → DETECTAR → EXPLICAR → DECIDIR → ACTUAR → MEDIR → APRENDER.

## Capas objetivo

### 1. System of Record

Registra correctamente qué ocurrió.

Ejemplos: pedido, venta, compra, movimiento de inventario, pago, gasto, desperdicio.

### 2. System of Context

Resuelve entidades y relaciones.

GRUK no ve únicamente un monto. Debe poder enlazar:

Venta → Pedido → Producto → Receta → Insumo → Inventario → Costo → Margen → Caja.

También debe conservar quién hizo qué, cuándo, dónde y bajo qué proceso.

### 3. System of Process

Modela cómo ocurrió el trabajo.

Ejemplo restaurante:

pedido creado → aceptado → cocina → listo → entregado → pagado.

Debe permitir medir tiempos, desviaciones y excepciones por etapa.

### 4. System of Intelligence

Detecta qué merece atención y por qué.

Regla determinística primero. Modelos solo cuando el problema realmente requiere interpretación.

### 5. System of Action

Expone capacidades empresariales seguras y reutilizables.

Ejemplos conceptuales:

- consultarStock()
- calcularCosto()
- consultarMargen()
- registrarDesperdicio()
- prepararCompra()
- transferirInventario()
- consultarProveedor()

La acción empresarial no debe depender de si la inicia un botón, lenguaje natural o un agente.

### 6. System of Learning

Conserva:

problema → contexto → decisión → acción → resultado.

El objetivo es aprender de decisiones y consecuencias, no únicamente almacenar transacciones.

## Activo estratégico

El activo de GRUK no debe ser un foundation model.

GRUK debe ser model-agnostic.

El activo acumulable es:

- datos estructurados;
- significado;
- relaciones;
- procesos;
- historial;
- reglas;
- permisos;
- acciones;
- decisiones;
- resultados;
- conocimiento vertical.

Un modelo futuro más capaz debe aumentar el valor de GRUK, no volverlo obsoleto.

## Arquitectura conceptual

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

Esto es arquitectura objetivo. No implica que todas estas capas estén implementadas hoy.

## Orquestación antes que proliferación de agentes

No crear un agente por departamento como sustituto de silos humanos.

Inventario, Finanzas, Compras, Ventas y Marketing pueden optimizar objetivos incompatibles.

El GRUK Orchestrator debe coordinar decisiones globales usando:

- objetivos;
- restricciones;
- prioridades;
- confianza;
- riesgo;
- impacto económico;
- permisos.

Los agentes especializados, cuando existan, deben proponer dentro de límites, no gobernar la empresa aisladamente.

## Objetivos y trade-offs

GRUK no debe "optimizar" sin objetivo.

Debe poder representar conflictos como:

- disponibilidad alta vs inventario bajo;
- margen alto vs conversión;
- crecimiento vs caja;
- descuento por volumen vs capital de trabajo;
- contratación vs productividad.

Una recomendación profesional debe expresar el intercambio, no declarar que una sola métrica domina universalmente.

## Expected vs Actual

Motor central futuro:

PLAN vs REALIDAD.

Ejemplos:

- ventas esperadas vs reales;
- costo esperado vs real;
- margen esperado vs real;
- inventario teórico vs físico;
- tiempo esperado vs real;
- desperdicio esperado vs real.

Flujo:

desviación → evidencia → causa candidata → impacto → acción → resultado.

## Evidence Layer

Toda afirmación crítica debe poder responder:

> ¿Cómo lo sabes?

Ejemplo:

proveedor → compra → precio → ingrediente → receta → producto → costo → margen.

La inteligencia interpreta. GRUK conserva evidencia trazable.

No declarar causas que los datos no demuestran.

## Autonomía progresiva

OBSERVAR
↓
EXPLICAR
↓
RECOMENDAR
↓
PREPARAR
↓
PEDIR APROBACIÓN
↓
ACTUAR CON LÍMITES
↓
AUTONOMÍA CONTROLADA

Cada proceso obtiene autonomía por evidencia de confiabilidad, no por marketing.

## Policy Engine e identidad

Cada humano, servicio o agente necesita:

- identidad;
- rol;
- permisos;
- límites;
- presupuesto;
- acciones disponibles;
- auditoría.

Ejemplo: un agente de inventario puede consultar stock y preparar una compra; no necesariamente aprobarla.

## Process Intelligence

GRUK debe aprender cómo fluye la operación y medir:

- duración de etapas;
- cuellos de botella;
- excepciones;
- diferencias por sede;
- impacto operativo/económico de la desviación.

## Decision Memory

Cada decisión relevante debe conservar:

qué ocurrió → contexto → alternativas → recomendación GRUK → decisión humana → acción → resultado.

La Memoria de Decisiones debe convertirse en un activo acumulativo.

## Integración

GRUK no necesita reemplazar todos los sistemas.

En empresas pequeñas puede proveer funciones directamente.

En empresas grandes puede actuar como capa de contexto, coordinación e inteligencia sobre ERP, WMS, CRM, bancos, nómina, facturación, IoT y otros sistemas.

## Ontologías verticales

El motor puede ser común; la ontología operacional no.

Restaurante:
receta → ingrediente → preparación → pedido.

Manufactura:
BOM → materia prima → máquina → orden → calidad.

Logística:
vehículo → conductor → ruta → paquete → entrega.

Construcción:
proyecto → actividad → material → contratista → avance.

No copiar Restaurante y cambiar el logo.

## AI Economics

La inteligencia tiene costo.

Escalera preferida:

regla determinística → modelo pequeño → modelo avanzado → humano.

Usar IA solo cuando la complejidad, riesgo y valor esperado lo justifican.

Medir eventualmente costo de inteligencia vs valor económico producido.

## Qué no construir ahora

- No crear 30 agentes.
- No entrar simultáneamente a diez industrias.
- No construir un foundation model propio.
- No competir frontalmente con SAP, Microsoft u Oracle.
- No construir cien integraciones antes de product-market fit.
- No automatizar procesos todavía mal entendidos.
- No entregar acceso indiscriminado de un LLM a la base de datos.
- No agregar módulos simplemente porque parecen interesantes.
- No confundir visión objetivo con capacidad actual.

## Regla de arquitectura

Cada nueva línea de código debe responder al menos una de estas preguntas:

1. ¿Mejora la confiabilidad del registro?
2. ¿Conecta una relación económica u operacional?
3. ¿Hace observable un proceso?
4. ¿Detecta una desviación relevante?
5. ¿Mejora evidencia o trazabilidad?
6. ¿Habilita una acción segura?
7. ¿Mide un resultado?
8. ¿Acumula aprendizaje reutilizable?

Si no responde ninguna, probablemente no es prioridad.
