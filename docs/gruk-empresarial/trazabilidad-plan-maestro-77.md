# Matriz de trazabilidad — GRUK Empresarial (77 requisitos)

Fuente: `GRUK_Documentos_Unificados_Plan_Maestro.docx` (9 de octubre de 2026), implementaciones 01–77. **Este documento no certifica implementaciones.** El estado inicial `NO VERIFICADO` significa que aún no se han vinculado pruebas reproducibles; no significa ausencia de código. No se deben marcar requisitos completados sin código, pruebas, ejecución CI y evidencia revisable. No incluye GRUK Finanzas Personales ni Blushea.

| ID | Prioridad | Requisito | Criterio de aceptación oficial | Código / PR | Test / ejecución CI | Estado |
|---|---|---|---|---|---|---|
| 01 | P0 | Separar GRUK empresarial de GRUK personal | Prueba automatizada comprueba aislamiento de datos y despliegues. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 02 | P0 | Inventariar funcionalidades ya construidas | Backlog basado en pruebas reales y sin funciones duplicadas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 03 | P0 | Definir un caso de uso inicial vendible | Se ejecuta de principio a fin con datos de prueba. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 04 | P0 | Modelo de datos por empresa y sede | No hay filtraciones entre empresas ni sedes. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 05 | P0 | Unificar estados y eventos | Cada cambio deja rastro y evita estados contradictorios. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 06 | P0 | Calidad de datos y conciliaciones | Panel muestra diferencias y permite corregirlas de forma trazable. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 07 | P0 | Motor determinista de cálculos | Pruebas unitarias de cálculos financieros e inventario. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 08 | P0 | Permisos y roles convencionales | Pruebas por rol deniegan acciones no autorizadas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 09 | P0 | Bitácora externa de operaciones | Se reconstruye una transacción de punta a punta. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 10 | P0 | Tablero de salud del negocio | Los números coinciden con transacciones reales. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 11 | P0 | Pilotear con restaurantes reales | Existe evidencia de necesidad y feedback verificable. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 12 | P0 | Instrumentar métricas del producto | Hay panel semanal sin depender de estimaciones manuales. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 13 | P0 | Definir contratos de herramientas | Cada tool tiene esquema, pruebas, permisos y manejo de errores. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 14 | P0 | Lanzar un único agente inicial | Resuelve 20 casos de prueba mejor que búsqueda manual. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 15 | P0 | Separar hechos, hipótesis y recomendaciones | Nunca presenta hipótesis como hechos. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 16 | P1 | GRUK Business State | Actualiza inventario/caja/pedidos tras eventos sin lag injustificado. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 17 | P1 | Registro de objetivos (Goal Registry) | Se puede seguir y cerrar un objetivo con evidencia. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 18 | P1 | Detección y priorización de oportunidades | Cada alerta explica cálculo, impacto y acción sugerida. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 19 | P1 | Evaluador de resultados | Reportes de acierto, error, costo y correcciones. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 20 | P1 | Verificación y aprobación humana | Pruebas demuestran que no hay pago/cambio irreversible sin permiso. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 21 | P1 | ROI por flujo, no por cantidad de agentes | Caso piloto demuestra beneficio neto con supuestos declarados. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 22 | P1 | Historial de eventos (Historical Lake) | Se puede reconstituir una situación histórica. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 23 | P1 | Business Graph | Consultas cruzadas muestran dependencias reales. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 24 | P1 | Memory Index y búsqueda con evidencia | Respuesta enlaza registros consultables. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 25 | P2 | Memoria episódica | Caso pasado se recupera por similitud y fechas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 26 | P2 | Memoria semántica | Los hechos desactualizados se señalan. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 27 | P2 | Memoria procedimental / skills | Skill se ejecuta únicamente en su ámbito válido. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 28 | P2 | Memoria de fallos | El agente evita una repetición en evaluación histórica. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 29 | P2 | Procedencia y autoridad de recuerdos | Resumen nunca amplía autorización del dato original. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 30 | P2 | Caducidad, corrección y olvido | Dato revocado deja de influir en respuestas y búsquedas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 31 | P2 | Memory Researcher bajo demanda | Acierto/costo superiores a la búsqueda simple en benchmarks internos. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 32 | P2 | Memoria jerárquica | Menos tokens sin degradar decisiones verificadas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 33 | P2 | Memory Architect (investigación) | Cambios promocionados solo tras benchmark, revisión y rollback. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 34 | P2 | Representación de incertidumbre (Belief State) | Incidentes con datos contradictorios generan preguntas, no inventos. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 35 | P1 | Control Plane independiente | Todas las herramientas validan autorización en servidor. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 36 | P1 | Capability Registry | Agente de inventario no ve ni usa nómina o transferencias. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 37 | P1 | Execution Engine gobernado | Flujo fallido no duplica compras ni cobros. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 38 | P1 | Verificación posterior a cada acción | Acción se marca terminada solo con comprobación. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 39 | P2 | GRUK Core coordinador | Tarea transversal resuelta con rastro de decisiones. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 40 | P2 | Agente de inventario | Mejora KPI frente a línea base en piloto. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 41 | P2 | Agente de finanzas | Explica cifras y muestra fuentes de cada cálculo. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 42 | P2 | Agente de ventas | Recomendaciones conectadas a margen real. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 43 | P2 | Agente de compras y proveedores | Propuestas trazables y aprobadas antes de ejecutar. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 44 | P2 | Agente de operaciones y atención | Reduce tiempo de cierre de incidencias medido. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 45 | P2 | Agente de marketing | No envía campañas sin consentimiento/base jurídica aplicable. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 46 | P2 | Agente de RR. HH. limitado | Accesos diferenciados y sin decisiones laborales automáticas indebidas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 47 | P2 | Delegación segura entre agentes | Un subagente nunca aumenta el límite del agente padre. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 48 | P2 | Agentes persistentes con seguimiento | Objetivo sobrevive a reinicio y pide humano si no puede avanzar. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 49 | P2 | Integraciones API y RPA cuando sea necesario | Conectores tienen versionado, fallbacks y auditoría. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 50 | P2 | Voz como interfaz opcional | Identificación y autorización equivalentes a interfaz escrita. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 51 | P2 | Business Simulator / Sandbox | Simula sin afectar clientes, dinero ni inventario real. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 52 | P2 | Experiment Engine | Experimento pequeño tiene criterio de éxito y parada. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 53 | P2 | Replay continuo de regresión | Versión nueva no empeora casos críticos. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 54 | P2 | Skill Factory | Skill supera baseline y pasa revisión. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 55 | P2 | Gestión de versiones de skills | Puede revertirse cualquier skill dañina. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 56 | P2 | Correcciones en tiempo de ejecución | Mejor recuperación en casos reproducibles. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 57 | P2 | Evaluación de agentes por tareas | Solo se agrega complejidad si hay mejora medible. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 58 | P2 | Atribución económica prudente | No se atribuye todo crecimiento a GRUK sin evidencia. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 59 | P2 | Model Router | Menor costo por éxito sin pérdida de calidad. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 60 | P2 | FinOps de inteligencia | Presupuesto y costos visibles por cliente/agente. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 61 | P2 | Autonomy Rate con calidad | Tasas respaldadas por muestras verificadas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 62 | P2 | Reasoning Compression Ratio | Disminuye costo manteniendo desempeño. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 63 | P2 | Valor neto / ROII | Panel financiero defendible para cliente. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 64 | P3 | Apprentice Models | Primero predicen; luego proponen; solo ejecutan bajo umbrales validados. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 65 | P3 | Ejecución especulativa y local | Aceleración medida en tareas representativas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 66 | P3 | Auto-mejora del harness | Cambio requiere pruebas y promoción humana. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 67 | P3 | Entrenamiento con lecciones validadas | Generaliza a datos nuevos sin empeorar seguridad. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 68 | P3 | Optimización de memoria autoajustable | Prueba A/B con precisión, latencia y costo. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 69 | P0 | Constitución operativa de GRUK | Pruebas de ataque no obtienen autoelevación. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 70 | P0 | Aislamiento multiempresa | Pruebas negativas entre cuentas. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 71 | P1 | Protección frente a inyección y poisoning | Batería adversarial documentada. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 72 | P1 | Contención de ejecución | Kill switch operativo y probado. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 73 | P1 | Observabilidad independiente | Incidentes se investigan sin depender de memoria del agente. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 74 | P1 | Seguridad y privacidad por diseño | Revisión legal/seguridad antes de producción. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 75 | P1 | Gobierno de cambios | Cada actualización puede probarse y revertirse. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 76 | P2 | Gestión de incidentes y respuesta | Simulacro de incidente completado. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |
| 77 | P2 | Seguridad de memoria y delegación | Pruebas de lavado de autoridad fallan. | Pendiente de mapear | Pendiente de verificar | NO VERIFICADO |

## Protocolo de certificación

Para cada ID: identificar código existente y su ámbito de empresa/sede; agregar o localizar tests positivos, negativos, concurrencia y aislamiento cuando corresponda; registrar SHA, PR, enlace de ejecución CI y resultado; revisar regresiones y seguridad; solo entonces cambiar el estado a `VERIFICADO`. Mantener los requisitos del anexo P0.01–P9.10 como checklist complementario, no confundir sus identificadores con los 77.
