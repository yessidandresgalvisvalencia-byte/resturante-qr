# GRUK Empresarial — matriz oficial de trazabilidad 01–77

**Fuente:** `GRUK_Documentos_Unificados_Plan_Maestro.docx`, 9-oct-2026. Los 77 criterios de aceptación siguientes se transcriben del documento, no son inferencias de código. **Ningún requisito está certificado por esta matriz**. El anexo P0.01–P9.10 constituye una hoja complementaria, no sustituye estos IDs.

| ID | Implementación oficial | Prioridad | Criterio oficial de terminado | Código / PR candidato | Prueba / evidencia de aceptación | Estado |
|---|---|---|---|---|---|---|
| 01 | Separar GRUK empresarial de GRUK personal | P0 | Prueba automatizada comprueba aislamiento de datos y despliegues. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 02 | Inventariar funcionalidades ya construidas | P0 | Backlog basado en pruebas reales y sin funciones duplicadas. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 03 | Definir un caso de uso inicial vendible | P0 | Se ejecuta de principio a fin con datos de prueba. | PR #610 (parcial; E2E pendiente) | Pendiente de prueba integral reproducible y SHA/CI específico | Parcial, no certificado |
| 04 | Modelo de datos por empresa y sede | P0 | No hay filtraciones entre empresas ni sedes. | PR #610, #616, #614 (superposición; sin prueba integral) | Pendiente de prueba integral reproducible y SHA/CI específico | Parcial, no certificado |
| 05 | Unificar estados y eventos | P0 | Cada cambio deja rastro y evita estados contradictorios. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 06 | Calidad de datos y conciliaciones | P0 | Panel muestra diferencias y permite corregirlas de forma trazable. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 07 | Motor determinista de cálculos | P0 | Pruebas unitarias de cálculos financieros e inventario. | core/finance/enterpriseMoney.js; PR #612/#606 (parcial) | Pendiente de prueba integral reproducible y SHA/CI específico | Parcial, no certificado |
| 08 | Permisos y roles convencionales | P0 | Pruebas por rol deniegan acciones no autorizadas. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 09 | Bitácora externa de operaciones | P0 | Se reconstruye una transacción de punta a punta. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 10 | Tablero de salud del negocio | P0 | Los números coinciden con transacciones reales. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 11 | Pilotear con restaurantes reales | P0 | Existe evidencia de necesidad y feedback verificable. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 12 | Instrumentar métricas del producto | P0 | Hay panel semanal sin depender de estimaciones manuales. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 13 | Definir contratos de herramientas | P0 | Cada tool tiene esquema, pruebas, permisos y manejo de errores. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 14 | Lanzar un único agente inicial | P0 | Resuelve 20 casos de prueba mejor que búsqueda manual. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 15 | Separar hechos, hipótesis y recomendaciones | P0 | Nunca presenta hipótesis como hechos. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 16 | GRUK Business State | P1 | Actualiza inventario/caja/pedidos tras eventos sin lag injustificado. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 17 | Registro de objetivos (Goal Registry) | P1 | Se puede seguir y cerrar un objetivo con evidencia. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 18 | Detección y priorización de oportunidades | P1 | Cada alerta explica cálculo, impacto y acción sugerida. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 19 | Evaluador de resultados | P1 | Reportes de acierto, error, costo y correcciones. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 20 | Verificación y aprobación humana | P1 | Pruebas demuestran que no hay pago/cambio irreversible sin permiso. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 21 | ROI por flujo, no por cantidad de agentes | P1 | Caso piloto demuestra beneficio neto con supuestos declarados. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 22 | Historial de eventos (Historical Lake) | P1 | Se puede reconstituir una situación histórica. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 23 | Business Graph | P1 | Consultas cruzadas muestran dependencias reales. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 24 | Memory Index y búsqueda con evidencia | P1 | Respuesta enlaza registros consultables. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 25 | Memoria episódica | P2 | Caso pasado se recupera por similitud y fechas. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 26 | Memoria semántica | P2 | Los hechos desactualizados se señalan. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 27 | Memoria procedimental / skills | P2 | Skill se ejecuta únicamente en su ámbito válido. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 28 | Memoria de fallos | P2 | El agente evita una repetición en evaluación histórica. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 29 | Procedencia y autoridad de recuerdos | P2 | Resumen nunca amplía autorización del dato original. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 30 | Caducidad, corrección y olvido | P2 | Dato revocado deja de influir en respuestas y búsquedas. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 31 | Memory Researcher bajo demanda | P2 | Acierto/costo superiores a la búsqueda simple en benchmarks internos. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 32 | Memoria jerárquica | P2 | Menos tokens sin degradar decisiones verificadas. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 33 | Memory Architect (investigación) | P2 | Cambios promocionados solo tras benchmark, revisión y rollback. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 34 | Representación de incertidumbre (Belief State) | P2 | Incidentes con datos contradictorios generan preguntas, no inventos. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 35 | Control Plane independiente | P1 | Todas las herramientas validan autorización en servidor. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 36 | Capability Registry | P1 | Agente de inventario no ve ni usa nómina o transferencias. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 37 | Execution Engine gobernado | P1 | Flujo fallido no duplica compras ni cobros. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 38 | Verificación posterior a cada acción | P1 | Acción se marca terminada solo con comprobación. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 39 | GRUK Core coordinador | P2 | Tarea transversal resuelta con rastro de decisiones. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 40 | Agente de inventario | P2 | Mejora KPI frente a línea base en piloto. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 41 | Agente de finanzas | P2 | Explica cifras y muestra fuentes de cada cálculo. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 42 | Agente de ventas | P2 | Recomendaciones conectadas a margen real. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 43 | Agente de compras y proveedores | P2 | Propuestas trazables y aprobadas antes de ejecutar. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 44 | Agente de operaciones y atención | P2 | Reduce tiempo de cierre de incidencias medido. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 45 | Agente de marketing | P2 | No envía campañas sin consentimiento/base jurídica aplicable. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 46 | Agente de RR. HH. limitado | P2 | Accesos diferenciados y sin decisiones laborales automáticas indebidas. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 47 | Delegación segura entre agentes | P2 | Un subagente nunca aumenta el límite del agente padre. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 48 | Agentes persistentes con seguimiento | P2 | Objetivo sobrevive a reinicio y pide humano si no puede avanzar. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 49 | Integraciones API y RPA cuando sea necesario | P2 | Conectores tienen versionado, fallbacks y auditoría. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 50 | Voz como interfaz opcional | P2 | Identificación y autorización equivalentes a interfaz escrita. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 51 | Business Simulator / Sandbox | P2 | Simula sin afectar clientes, dinero ni inventario real. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 52 | Experiment Engine | P2 | Experimento pequeño tiene criterio de éxito y parada. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 53 | Replay continuo de regresión | P2 | Versión nueva no empeora casos críticos. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 54 | Skill Factory | P2 | Skill supera baseline y pasa revisión. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 55 | Gestión de versiones de skills | P2 | Puede revertirse cualquier skill dañina. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 56 | Correcciones en tiempo de ejecución | P2 | Mejor recuperación en casos reproducibles. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 57 | Evaluación de agentes por tareas | P2 | Solo se agrega complejidad si hay mejora medible. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 58 | Atribución económica prudente | P2 | No se atribuye todo crecimiento a GRUK sin evidencia. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 59 | Model Router | P2 | Menor costo por éxito sin pérdida de calidad. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 60 | FinOps de inteligencia | P2 | Presupuesto y costos visibles por cliente/agente. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 61 | Autonomy Rate con calidad | P2 | Tasas respaldadas por muestras verificadas. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 62 | Reasoning Compression Ratio | P2 | Disminuye costo manteniendo desempeño. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 63 | Valor neto / ROII | P2 | Panel financiero defendible para cliente. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 64 | Apprentice Models | P3 | Primero predicen; luego proponen; solo ejecutan bajo umbrales validados. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 65 | Ejecución especulativa y local | P3 | Aceleración medida en tareas representativas. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 66 | Auto-mejora del harness | P3 | Cambio requiere pruebas y promoción humana. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 67 | Entrenamiento con lecciones validadas | P3 | Generaliza a datos nuevos sin empeorar seguridad. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 68 | Optimización de memoria autoajustable | P3 | Prueba A/B con precisión, latencia y costo. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 69 | Constitución operativa de GRUK | P0 | Pruebas de ataque no obtienen autoelevación. | Pendiente auditoría de autoridad | Pendiente de prueba integral reproducible y SHA/CI específico | Parcial, no certificado |
| 70 | Aislamiento multiempresa | P0 | Pruebas negativas entre cuentas. | PR #610 (parcial) | Pendiente de prueba integral reproducible y SHA/CI específico | Parcial, no certificado |
| 71 | Protección frente a inyección y poisoning | P1 | Batería adversarial documentada. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 72 | Contención de ejecución | P1 | Kill switch operativo y probado. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 73 | Observabilidad independiente | P1 | Incidentes se investigan sin depender de memoria del agente. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 74 | Seguridad y privacidad por diseño | P1 | Revisión legal/seguridad antes de producción. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 75 | Gobierno de cambios | P1 | Cada actualización puede probarse y revertirse. | Workflows CI; PR #617 (respaldo/restauración; simulacro pendiente) | Pendiente de prueba integral reproducible y SHA/CI específico | Parcial, no certificado |
| 76 | Gestión de incidentes y respuesta | P2 | Simulacro de incidente completado. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |
| 77 | Seguridad de memoria y delegación | P2 | Pruebas de lavado de autoridad fallan. | Por inventariar | Pendiente de prueba integral reproducible y SHA/CI específico | Sin evidencia, no certificado |

## Protocolo de cierre
- Para cada ID registrar ruta y SHA del código, test reproducible, ejecución de CI del HEAD exacto, resultado de aceptación funcional y revisión independiente cuando corresponda. Un PR abierto o CI verde **no** demuestra cierre del criterio.
- P0-04/P0-70: probar aislamiento entre dos empresas y dos sedes en MongoDB, HTTP, Socket.IO, cachés, archivos y logs con casos positivos y negativos; validar credenciales read-only, operaciones legacy y no exposición de secretos.
- P0-07: verificar aritmética exacta sin flotantes, ledger, idempotencia, concurrencia, conciliación y stock; no inferir cobertura por un test de límites.
- No fusionar PR superpuestos (#614/#616) ni el consolidado comercial #610 sin auditoría, CI completo y revisión de seguridad. Resolver `GRUK Production Gate` y los checks obligatorios por SHA.
- Proteger absolutamente GRUK Finanzas Personales y Blushea. No desplegar Render hasta 77/77 criterios acreditados, E2E, revisión de seguridad, rollback probado y autorización; comprobar URL y `/health` HTTP 200.

## Evidencia acotada de esta actualización
La versión inicial del PR #621, commit `bfc042400509e4d2876bdaaab927ebf45bf3f978`, mostró tres workflows de PR exitosos (GRUK CI, GRUK quality gate, GRUK Offline Browser Persistence). **La nueva versión de esta matriz necesita sus propios checks**; no atribuirle los del commit anterior.
