# GRUK — Visión Arquitectónica y Disciplina de Ejecución

Fecha de referencia: 26 de septiembre de 2026.

## Definición

GRUK busca convertirse en una capa operacional e inteligente para empresas: construir una representación confiable de cómo funciona el negocio, conectar sus datos y procesos, detectar desviaciones y riesgos, explicar su impacto económico y ayudar a ejecutar acciones bajo reglas, permisos y supervisión humana, midiendo posteriormente sus resultados.

En restaurantes, la propuesta inmediata es más concreta:

> GRUK ayuda a restaurantes a conectar su operación para entender qué está pasando con sus ventas, inventario, costos, margen y caja, y convertir esa lectura en decisiones controladas y medibles.

## Fórmula

GRUK = CONTEXTO + PROCESOS + INTELIGENCIA + ACCIÓN + MEMORIA

Debajo de todo: datos confiables.

Encima de todo: resultado económico medible.

## Ciclo operativo

ENTENDER → DETECTAR → EXPLICAR → DECIDIR → ACTUAR → MEDIR → APRENDER.

GRUK no debe agregar una acción si no puede explicar qué hecho la originó, qué permiso la habilita y cómo se medirá después.

## Capas objetivo

### 1. System of Record

Responde: ¿qué ocurrió?

Registra hechos transaccionales canónicos: pedido, venta, compra, pago, movimiento de inventario, desperdicio, devolución y demás eventos operativos.

### 2. System of Context

Responde: ¿qué significa?

Relaciona entidades y hechos. Una cifra deja de ser un número aislado y pasa a tener contexto empresarial.

### 3. System of Process

Responde: ¿cómo ocurrió?

Representa secuencias como:

pedido → cocina → listo → entrega → pago.

Permite medir tiempos, desviaciones y excepciones.

### 4. System of Intelligence

Responde: ¿qué merece atención y por qué?

Primero aplica reglas determinísticas. La inteligencia generativa se usa solo cuando el problema requiere interpretación, síntesis o conversación experta.

### 5. System of Action

Responde: ¿qué podemos hacer?

Las acciones son capacidades empresariales reutilizables y auditables, no funciones especiales para IA.

### 6. System of Learning

Responde: ¿funcionó?

Conserva:

problema → evidencia → decisión → acción → resultado.

La memoria de decisiones y consecuencias es un activo estratégico de largo plazo.

## Cadena económica prioritaria del restaurante

La prioridad técnica inmediata es hacer impecable:

PEDIDO
→ VENTA
→ PRODUCTO
→ RECETA
→ INSUMO
→ INVENTARIO
→ COSTO
→ MARGEN
→ CAJA

La primera promesa que GRUK debe demostrar con rigor es:

> Vendiste esto, consumiste aproximadamente esto, te costó esto y te dejó esto.

Después:

> Deberías tener X, pero tienes Y.

Después:

> Algo se está desviando.

Después:

> Esta es la evidencia que apunta a la causa.

## Expected vs Actual

GRUK debe comparar continuamente plan contra realidad:

- ventas esperadas vs reales;
- costo esperado vs real;
- margen esperado vs real;
- inventario teórico vs físico;
- tiempo esperado vs real;
- desperdicio esperado vs real.

La secuencia correcta es:

desviación → evidencia → causa probable → impacto → acción → medición.

## Evidence Layer

Una recomendación importante debe poder responder:

> ¿Cómo lo sabes?

Ejemplo de trazabilidad:

proveedor → compra → insumo → receta → producto → venta → costo → margen.

La inteligencia interpreta. GRUK conserva la evidencia.

Nunca se presenta una causa como hecho si la cadena de evidencia no la soporta.

## Objetivos, restricciones y trade-offs

GRUK no “optimiza” de forma abstracta.

La empresa define objetivos y restricciones como:

- disponibilidad;
- inventario;
- margen;
- caja;
- servicio;
- capacidad.

Las recomendaciones deben expresar trade-offs.

Ejemplo correcto:

> Comprar reduce riesgo de agotamiento, pero aumenta inventario y compromete caja.

Ejemplo incorrecto:

> Comprar más es mejor.

## Orquestación

GRUK no debe convertirse en una colección de agentes aislados.

La arquitectura objetivo conserva funciones especialistas, pero un orquestador coordina decisiones globales y resuelve conflictos.

No se crean nuevos agentes sin demostrar que una función especialista necesita autonomía separada.

## Autonomía progresiva

La progresión oficial es:

OBSERVAR
→ EXPLICAR
→ RECOMENDAR
→ PREPARAR
→ PEDIR APROBACIÓN
→ ACTUAR CON LÍMITES
→ AUTONOMÍA CONTROLADA.

La autonomía se gana por proceso y por evidencia, no por moda tecnológica.

## Política, identidad y permisos

Todo humano o agente debe tener:

- identidad;
- rol;
- empresa;
- sede;
- permisos;
- límites;
- presupuesto;
- acciones autorizadas;
- auditoría.

Una capacidad de lectura no implica capacidad de escritura.

Una capacidad de preparación no implica aprobación.

## Model agnostic

El moat de GRUK no es un modelo fundacional.

El activo debe ser la representación estructurada del negocio:

datos + significado + relaciones + procesos + historial + reglas + permisos + acciones + resultados.

Los modelos de IA son componentes reemplazables.

## AI Economics

Antes de usar un modelo, GRUK debe preguntarse si una regla determinística resuelve el problema.

Escalamiento deseado:

regla
→ cálculo determinístico
→ modelo pequeño
→ modelo avanzado
→ humano.

La inteligencia debe justificarse por dificultad, riesgo y valor esperado.

## Verticalización

El motor GRUK puede ser común, pero cada industria requiere ontología propia.

Restaurante:
receta → ingrediente → preparación → pedido.

Manufactura:
BOM → materia prima → máquina → orden → calidad.

Logística:
vehículo → conductor → ruta → paquete → entrega.

No se copia un vertical cambiando el logo.

## Integration Layer

GRUK no necesita reemplazar todos los sistemas.

En pequeñas empresas puede proveer funciones directamente.

En empresas mayores debe poder conectarse a ERP, CRM, WMS, bancos, nómina, facturación, IoT y otros sistemas.

La visión futura es:

> Conéctalo a GRUK.

## Lo que NO se debe construir ahora

- No 30 agentes.
- No diez industrias simultáneamente.
- No foundation model propio.
- No cien integraciones antes de product-market fit.
- No automatización de procesos que todavía no comprendemos.
- No acceso indiscriminado de un LLM a la base de datos.
- No funcionalidades nuevas solo porque “suenan inteligentes”.
- No dashboards sin una decisión o trabajo concreto detrás.

## GRUK actual vs arquitectura objetivo

### Capacidad actual confirmada en el repositorio

GRUK ya dispone, con distintos niveles de madurez, de:

- Empresa, Sede y Usuario;
- pedidos y estados operacionales;
- pagos y ventas vinculadas;
- inventario y vencimientos;
- compras y gastos;
- caja canónica;
- Tesorería;
- obligaciones;
- proyección financiera;
- políticas y aprobaciones;
- Junta y Cerebro;
- memoria y auditoría;
- reservas y retiros del dueño;
- eventos internos;
- controles de acceso empresariales.

### Arquitectura objetivo, no declarar como capacidad completa todavía

- Economic Graph integral;
- Semantic Layer completa;
- Entity Resolution general;
- Process Intelligence transversal;
- Expected vs Actual generalizado;
- Evidence Layer completa de punta a punta;
- Action Layer uniforme para todo el negocio;
- Integration Layer empresarial;
- agentes autónomos especializados;
- AI Economics dinámico;
- autonomía avanzada por proceso.

La documentación, marketing y Junta deben respetar esta separación.

## Qué construir ahora

Orden de profundidad:

1. PEDIDO → VENTA.
2. VENTA → PRODUCTO.
3. PRODUCTO → RECETA.
4. RECETA → INSUMO.
5. INSUMO → INVENTARIO.
6. INVENTARIO → COSTO.
7. COSTO → MARGEN.
8. MARGEN → CAJA.
9. Compra/proveedor y reposición.
10. Inventario físico vs teórico.
11. Event Log y telemetría de proceso.
12. Expected vs Actual.
13. Exception Engine.
14. Evidence Layer.
15. Action Layer.
16. Un solo agente operacional cuando la cadena anterior sea confiable.

## Pregunta obligatoria antes de agregar código

Toda nueva funcionalidad debe responder:

1. ¿Qué problema real del restaurante resuelve?
2. ¿Qué función crítica tiene responsable y KPI?
3. ¿Qué dato canónico necesita?
4. ¿Qué evento la actualiza?
5. ¿Qué evidencia produce?
6. ¿Qué decisión mejora?
7. ¿Qué acción habilita?
8. ¿Qué permiso protege esa acción?
9. ¿Cómo medimos el resultado?
10. ¿Ayuda a profundizar la cadena prioritaria o la distrae?

Si no puede responder estas preguntas, no entra al alcance inmediato.

## Criterio comercial

Mientras se desarrolla, GRUK necesita restaurantes reales.

El experimento prioritario no es demostrar que la arquitectura es sofisticada.

Es demostrar:

- que pagan;
- que usan;
- que regresan;
- qué problema les duele;
- qué información no tenían;
- qué función produce hábito;
- qué resultado económico obtiene el cliente.

La dirección tecnológica tiene fundamento. El siguiente riesgo principal es product-market fit, no falta de visión.

## Moat

El activo acumulable es:

clientes + contexto operacional + historial + integraciones + workflows + datos estructurados + decisiones + resultados + conocimiento vertical + distribución.

Un competidor puede copiar una pantalla o usar el mismo modelo.

Es mucho más difícil copiar años de aprendizaje operacional estructurado con clientes reales.
