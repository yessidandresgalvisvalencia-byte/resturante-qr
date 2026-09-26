# GRUK Restaurantes — Roadmap de ejecución disciplinada

Este documento convierte la visión rectora en orden de trabajo.

## P0 — Cadena económica impecable

Objetivo:

**PEDIDO → VENTA → PRODUCTO → RECETA → INSUMO → INVENTARIO → COSTO → MARGEN**

Criterios de salida:

- cada venta pagada referencia su origen operacional cuando exista;
- cada producto vendible puede vincularse a receta;
- cada receta identifica insumos y cantidades;
- cada insumo consumible tiene unidad consistente;
- la venta congela costo demostrable;
- el margen distingue costo confiable de costo incompleto;
- inventario teórico puede derivarse de eventos;
- ninguna neurona inventa costo, consumo o objetivo;
- Evidence Layer puede explicar el costo desde venta hasta insumo.

## P1 — Reconciliación física y compras

Construir después de P0:

- proveedor canónico;
- compra → insumo explícito;
- recepción de compra;
- movimiento de inventario;
- conteo físico;
- ajuste/reconciliación;
- merma/desperdicio;
- diferencia teórico vs físico;
- impacto económico de la diferencia.

Salida esperada:

> Deberías tener X, tienes Y, la diferencia vale Z y estas son las evidencias disponibles.

## P2 — Telemetría de proceso

Solo cuando los eventos P0/P1 sean confiables:

- event log durable;
- correlación por pedido/proceso;
- timestamps de etapas;
- expected vs actual de tiempos;
- excepciones;
- comparación por sede.

Primer proceso:

**pedido creado → aceptado → cocina → listo → entregado → pagado**

## P3 — Exception + Evidence Engine

Unificar detección determinística:

- margen fuera de objetivo;
- stockout;
- variación de costo;
- merma anormal;
- diferencia físico/teórico;
- demora de proceso;
- caja insuficiente.

Cada excepción debe incluir:

- hecho;
- baseline/objetivo;
- desviación;
- evidencia;
- impacto cuantificado cuando exista;
- confianza;
- datos faltantes.

## P4 — Action Layer

Extraer acciones reutilizables desde servicios existentes.

Principio obligatorio:

`route → controller → service → model → eventBus.emit()`

Acciones prioritarias:

- consultar stock;
- registrar conteo;
- registrar merma;
- preparar compra;
- registrar recepción;
- consultar margen;
- consultar costo;
- registrar pago;
- transferir inventario.

Los agentes no escriben directamente en Mongo.

## P5 — Un agente operacional

No crear enjambre.

Crear un único agente cuando P0–P4 estén confiables.

Misión:

> Detectar dónde el restaurante necesita atención económica u operacional y presentar evidencia.

Nivel de autonomía inicial:

- observa;
- explica;
- recomienda;
- prepara;
- pide aprobación.

No ejecuta compras/pagos autónomos.

## Backlog bloqueado hasta evidencia de necesidad

- multiindustria;
- decenas de agentes;
- Semantic Layer general;
- Economic Graph genérico;
- integraciones ERP masivas;
- AI Economics avanzado;
- autonomía financiera;
- foundation model propio.

## Métricas de producto

El roadmap técnico debe medirse junto con restaurantes reales:

- activación;
- tiempo hasta primer valor;
- frecuencia de uso;
- retención;
- decisiones aprobadas;
- decisiones con resultado medible;
- ahorro o ingreso atribuible;
- reducción de merma;
- mejora de margen;
- precisión inventario teórico/físico;
- usuarios que regresan sin recordatorio.

## Regla final

No abrir P(n+1) para esconder defectos de P(n).

Profundidad antes que amplitud.
