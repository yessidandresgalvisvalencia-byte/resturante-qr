# GRUK Empresarial — Acciones y criterios originales de aceptación (77 requisitos)

**Fuente única:** `GRUK_Documentos_Unificados_Plan_Maestro.docx` (9 de octubre de 2026). Transcripción de los 77 ítems del plan; **NO** certifica implementación, pruebas ni despliegue. La columna «Criterio» define qué evidencia falta demostrar antes de marcar `VERIFICADO` en la matriz de trazabilidad. La fuente también contiene anexos de planificación, que no se sustituyen por esta tabla.

| ID | Prioridad | Implementación | Acción requerida en el Word | Criterio de terminado del Word |
|---|---|---|---|---|
| 01 | P0 | Separar GRUK empresarial de GRUK personal | Mantener repositorios, bases de datos, rutas, permisos y métricas independientes; prevenir modificaciones cruzadas. | Prueba automatizada comprueba aislamiento de datos y despliegues. |
| 02 | P0 | Inventariar funcionalidades ya construidas | Registrar pedidos QR, caja, inventario, cocina, facturación, empleados, clientes y finanzas; etiquetar terminado/parcial/roto. | Backlog basado en pruebas reales y sin funciones duplicadas. |
| 03 | P0 | Definir un caso de uso inicial vendible | Elegir un flujo integral en restaurante (pedido → venta → descuento de inventario → caja → reporte). | Se ejecuta de principio a fin con datos de prueba. |
| 04 | P0 | Modelo de datos por empresa y sede | Normalizar Empresa, Sede, Usuario, producto, pedido, venta, pago, stock y proveedor con IDs estables. | No hay filtraciones entre empresas ni sedes. |
| 05 | P0 | Unificar estados y eventos | Definir estados válidos de pedidos, pagos, inventario, devolución y entrega; registrar transiciones. | Cada cambio deja rastro y evita estados contradictorios. |
| 06 | P0 | Calidad de datos y conciliaciones | Validar duplicados, movimientos sin soporte, caja/ventas y stock registrado vs físico. | Panel muestra diferencias y permite corregirlas de forma trazable. |
| 07 | P0 | Motor determinista de cálculos | Forecasts simples, ingresos, margen, IVA donde aplique, costos, deuda y caja con reglas auditables; no delegar aritmética al LLM. | Pruebas unitarias de cálculos financieros e inventario. |
| 08 | P0 | Permisos y roles convencionales | Definir dueño, gerente, cajero, inventario, cocina, contador y administrador de plataforma. | Pruebas por rol deniegan acciones no autorizadas. |
| 09 | P0 | Bitácora externa de operaciones | Registrar actor, origen, hora, antes/después y resultado en almacenamiento que los agentes no puedan editar. | Se reconstruye una transacción de punta a punta. |
| 10 | P0 | Tablero de salud del negocio | Mostrar datos confirmados, alertas de errores y KPIs que sí puedan reconciliarse. | Los números coinciden con transacciones reales. |
| 11 | P0 | Pilotear con restaurantes reales | Observar 3–5 negocios, documentar fricciones y obtener línea base de tiempo, errores y costos. | Existe evidencia de necesidad y feedback verificable. |
| 12 | P0 | Instrumentar métricas del producto | Medir usuarios activos, pedidos válidos, errores, tiempo por tarea y retención. | Hay panel semanal sin depender de estimaciones manuales. |
| 13 | P0 | Definir contratos de herramientas | Crear herramientas tipadas: consultar ventas, stock, margen, órdenes, proveedores y facturas; respuestas estructuradas. | Cada tool tiene esquema, pruebas, permisos y manejo de errores. |
| 14 | P0 | Lanzar un único agente inicial | Agente supervisor para explicar diferencias de ventas/inventario con citas internas, sin modificar datos. | Resuelve 20 casos de prueba mejor que búsqueda manual. |
| 15 | P0 | Separar hechos, hipótesis y recomendaciones | Etiquetar valor confirmado, estimado, supuesto, nivel de evidencia y dato faltante. | Nunca presenta hipótesis como hechos. |
| 16 | P1 | GRUK Business State | Mantener estado operativo actual verificable por empresa/sede, con sello temporal y procedencia. | Actualiza inventario/caja/pedidos tras eventos sin lag injustificado. |
| 17 | P1 | Registro de objetivos (Goal Registry) | Objetivo, dueño, horizonte, línea base, KPIs, presupuesto, estado y autorización. | Se puede seguir y cerrar un objetivo con evidencia. |
| 18 | P1 | Detección y priorización de oportunidades | Reglas para alertar stockouts, desperdicio, desbalance de caja, caída de margen y atrasos. | Cada alerta explica cálculo, impacto y acción sugerida. |
| 19 | P1 | Evaluador de resultados | Comparar predicción/propuesta con lo realmente ocurrido, sin atribuir causalidad automáticamente. | Reportes de acierto, error, costo y correcciones. |
| 20 | P1 | Verificación y aprobación humana | Las acciones sensibles crean borradores y requieren una confirmación explícita. | Pruebas demuestran que no hay pago/cambio irreversible sin permiso. |
| 21 | P1 | ROI por flujo, no por cantidad de agentes | Comparar línea base y nuevo proceso: tiempo, costo, calidad, errores, ventas o margen. | Caso piloto demuestra beneficio neto con supuestos declarados. |
| 22 | P1 | Historial de eventos (Historical Lake) | Guardar eventos operacionales relevantes con versiones, retención y minimización de datos. | Se puede reconstituir una situación histórica. |
| 23 | P1 | Business Graph | Relacionar empresa–sede–producto–proveedor–pedido–cliente–campaña–margen y empleado– turno–venta. | Consultas cruzadas muestran dependencias reales. |
| 24 | P1 | Memory Index y búsqueda con evidencia | Indexar historia y documentos y devolver citas precisas, no solo embeddings sin fuentes. | Respuesta enlaza registros consultables. |
| 25 | P2 | Memoria episódica | Conservar qué decisión se tomó, circunstancias, acciones y resultado. | Caso pasado se recupera por similitud y fechas. |
| 26 | P2 | Memoria semántica | Guardar hechos estables sobre productos, procesos y entidades, con vencimiento. | Los hechos desactualizados se señalan. |
| 27 | P2 | Memoria procedimental / skills | Guardar procedimientos comprobados, precondiciones, límites y pruebas. | Skill se ejecuta únicamente en su ámbito válido. |
| 28 | P2 | Memoria de fallos | Registrar intentos fallidos, causas sustentadas y lecciones para no repetir errores. | El agente evita una repetición en evaluación histórica. |
| 29 | P2 | Procedencia y autoridad de recuerdos | Fuente original, permisos, confiabilidad, cadena de resúmenes y ámbito permitido; no lavar autoridad. | Resumen nunca amplía autorización del dato original. |
| 30 | P2 | Caducidad, corrección y olvido | Versionar recuerdos, invalidar cuando cambie información y cumplir borrados pertinentes. | Dato revocado deja de influir en respuestas y búsquedas. |
| 31 | P2 | Memory Researcher bajo demanda | Investigar el historial paso a paso hasta encontrar evidencia suficiente. | Acierto/costo superiores a la búsqueda simple en benchmarks internos. |
| 32 | P2 | Memoria jerárquica | Resumen → entidad/hecho → evidencia → evento original; profundizar solo cuando hace falta. | Menos tokens sin degradar decisiones verificadas. |
| 33 | P2 | Memory Architect (investigación) | Probar índices, rutas y resúmenes alternativos sin modificar producción directamente. | Cambios promocionados solo tras benchmark, revisión y rollback. |
| 34 | P2 | Representación de incertidumbre (Belief State) | Diferenciar qué sabe, qué cree, qué contradicciones existen y qué falta resolver. | Incidentes con datos contradictorios generan preguntas, no inventos. |
| 35 | P1 | Control Plane independiente | Permisos, presupuesto, alcance, riesgo y aprobaciones fuera del razonamiento del modelo. | Todas las herramientas validan autorización en servidor. |
| 36 | P1 | Capability Registry | Definir herramientas por agente/rol; principio de mínimo privilegio. | Agente de inventario no ve ni usa nómina o transferencias. |
| 37 | P1 | Execution Engine gobernado | Ejecutar comandos tipados, idempotentes y reversibles donde sea posible, con timeouts y compensación. | Flujo fallido no duplica compras ni cobros. |
| 38 | P1 | Verificación posterior a cada acción | Comprobar efectos reales del sistema; no confiar en “hecho” declarado por el modelo. | Acción se marca terminada solo con comprobación. |
| 39 | P2 | GRUK Core coordinador | Asignar trabajos, integrar evidencia y resolver conflictos entre objetivos. | Tarea transversal resuelta con rastro de decisiones. |
| 40 | P2 | Agente de inventario | Proponer reposición, detectar desperdicio y revisar stockouts. | Mejora KPI frente a línea base en piloto. |
| 41 | P2 | Agente de finanzas | Analizar flujo, margen, compromisos y conciliaciones; no mover dinero automáticamente. | Explica cifras y muestra fuentes de cada cálculo. |
| 42 | P2 | Agente de ventas | Analizar conversión, ticket, campañas y seguimiento comercial. | Recomendaciones conectadas a margen real. |
| 43 | P2 | Agente de compras y proveedores | Comparar precio, puntualidad, condiciones y crear borradores de órdenes. | Propuestas trazables y aprobadas antes de ejecutar. |
| 44 | P2 | Agente de operaciones y atención | Coordinar cocina, turnos, incidencias y seguimiento al cliente. | Reduce tiempo de cierre de incidencias medido. |
| 45 | P2 | Agente de marketing | Diseñar experimentos pequeños con presupuesto y límites de margen. | No envía campañas sin consentimiento/base jurídica aplicable. |
| 46 | P2 | Agente de RR. HH. limitado | Asistir horarios, capacitación y tareas, con controles reforzados para datos laborales. | Accesos diferenciados y sin decisiones laborales automáticas indebidas. |
| 47 | P2 | Delegación segura entre agentes | Conservar identidad/objetivo/cadena de autoridad y mínimo privilegio en cada subagente. | Un subagente nunca aumenta el límite del agente padre. |
| 48 | P2 | Agentes persistentes con seguimiento | Reanudar objetivos, manejar esperas, límites, interrupción y caducidad. | Objetivo sobrevive a reinicio y pide humano si no puede avanzar. |
| 49 | P2 | Integraciones API y RPA cuando sea necesario | API primero; automatización visual solo para sistemas heredados sin API confiable. | Conectores tienen versionado, fallbacks y auditoría. |
| 50 | P2 | Voz como interfaz opcional | Comandos por voz con confirmación explícita para acciones sensibles. | Identificación y autorización equivalentes a interfaz escrita. |
| 51 | P2 | Business Simulator / Sandbox | Reproducir históricos con resultados observables y supuestos explícitos. | Simula sin afectar clientes, dinero ni inventario real. |
| 52 | P2 | Experiment Engine | Hipótesis → control/variante → medición → decisión; efectos no atribuidos sin método. | Experimento pequeño tiene criterio de éxito y parada. |
| 53 | P2 | Replay continuo de regresión | Volver a ejecutar incidentes y situaciones pasadas al cambiar modelos/prompts/skills. | Versión nueva no empeora casos críticos. |
| 54 | P2 | Skill Factory | Convertir patrones repetidos en código/reglas verificables con ámbito y aprobación. | Skill supera baseline y pasa revisión. |
| 55 | P2 | Gestión de versiones de skills | Evidencia, condiciones, caducidad, pruebas, porcentaje de éxito y rollback. | Puede revertirse cualquier skill dañina. |
| 56 | P2 | Correcciones en tiempo de ejecución | Detectar fallos y suministrar solo la lección pertinente en vez de cargar toda la memoria. | Mejor recuperación en casos reproducibles. |
| 57 | P2 | Evaluación de agentes por tareas | Comparar un agente simple vs equipos multiagente, mismo presupuesto/modelo. | Solo se agrega complejidad si hay mejora medible. |
| 58 | P2 | Atribución económica prudente | Medir efectos netos y costos; usar grupos control y explicitar incertidumbre. | No se atribuye todo crecimiento a GRUK sin evidencia. |
| 59 | P2 | Model Router | Seleccionar código determinista, modelo pequeño, modelo medio o frontier según riesgo y complejidad. | Menor costo por éxito sin pérdida de calidad. |
| 60 | P2 | FinOps de inteligencia | Registrar tokens, tiempo, tools, infraestructura, verificación, costo por tarea y por objetivo. | Presupuesto y costos visibles por cliente/agente. |
| 61 | P2 | Autonomy Rate con calidad | Medir decisiones correctas completadas sin humano por tipo de riesgo, no solo volumen. | Tasas respaldadas por muestras verificadas. |
| 62 | P2 | Reasoning Compression Ratio | Medir cuánto trabajo repetitivo migra a skills/código sin degradación. | Disminuye costo manteniendo desempeño. |
| 63 | P2 | Valor neto / ROII | Beneficio incremental o costo evitado menos costo total de IA, con cuidado de doble conteo. | Panel financiero defendible para cliente. |
| 64 | P3 | Apprentice Models | Entrenar modelos pequeños para proponer acciones repetitivas observadas de modelos expertos. | Primero predicen; luego proponen; solo ejecutan bajo umbrales validados. |
| 65 | P3 | Ejecución especulativa y local | Explorar anticipación de acciones, caching y ejecución local para reducir latencia. | Aceleración medida en tareas representativas. |
| 66 | P3 | Auto-mejora del harness | Proponer cambios de prompts, memoria y workflows; evaluar fuera de producción. | Cambio requiere pruebas y promoción humana. |
| 67 | P3 | Entrenamiento con lecciones validadas | Investigar fine-tuning sobre errores verificados y tareas específicas. | Generaliza a datos nuevos sin empeorar seguridad. |
| 68 | P3 | Optimización de memoria autoajustable | Permitir que propuestas experimentales reorganizen recuperación/índices en entorno aislado. | Prueba A/B con precisión, latencia y costo. |
| 69 | P0 | Constitución operativa de GRUK | Reglas no modificables por agentes: datos, acceso, dinero, privacidad, acciones prohibidas y humano obligatorio. | Pruebas de ataque no obtienen autoelevación. |
| 70 | P0 | Aislamiento multiempresa | Controles de tenant en DB, cachés, búsquedas, archivos y logs. | Pruebas negativas entre cuentas. |
| 71 | P1 | Protección frente a inyección y poisoning | Tratar documentos, emails, salidas de tools y memorias como datos no confiables hasta validación. | Batería adversarial documentada. |
| 72 | P1 | Contención de ejecución | Sandbox, límites de red, credenciales efímeras, rate limits y capacidad de detener agentes. | Kill switch operativo y probado. |
| 73 | P1 | Observabilidad independiente | Logs externos, alertas de comportamiento extraño, costos anómalos y auditoría de delegación. | Incidentes se investigan sin depender de memoria del agente. |
| 74 | P1 | Seguridad y privacidad por diseño | Retención mínima, consentimiento, control de acceso y eliminación trazable según normativa. | Revisión legal/seguridad antes de producción. |
| 75 | P1 | Gobierno de cambios | CI/CD, entorno staging, pruebas, controles de versión y aprobación de despliegues. | Cada actualización puede probarse y revertirse. |
| 76 | P2 | Gestión de incidentes y respuesta | Definir bloqueo, notificación, revisión de logs y restauración. | Simulacro de incidente completado. |
| 77 | P2 | Seguridad de memoria y delegación | Validar autoridad original y cadena de autorización a través de resúmenes y subagentes. | Pruebas de lavado de autoridad fallan. |
