# GRUK Empresarial — matriz conservadora de trazabilidad (77 IDs)

Fuente: `GRUK_Documentos_Unificados_Plan_Maestro.docx` (9-oct-2026). Esta matriz **no certifica** ninguna implementación. Se registran criterios contrastados con el documento oficial; los 77 identificadores y sus criterios de terminado han sido cotejados con el Word. Esto es trazabilidad documental, no prueba de ejecución ni certificación. El anexo P0.01–P9.10 usa identificadores distintos y no sustituye estos 77 IDs.

Estado global: **0/77 certificados en esta matriz**. Evidencia #07 actualizada al `main` `6f5743251915fbae6cf53eafc92e3ee3be8f3545` (2026-11-07); la presencia de código y PRs fusionados no demuestra aceptación completa. Un PR abierto, un test escrito o un workflow exitoso aislado no equivalen a aceptación funcional. `main` y Render no se modifican con este PR.

| ID | Implementación oficial | Criterio de terminado oficial | Código / tests / evidencia identificada | Estado |
|---|---|---|---|---|
| 01 | Separar GRUK empresarial de GRUK personal | Prueba automatizada comprueba aislamiento de datos y despliegues | Sin evidencia verificada registrada | No certificado |
| 02 | Inventariar funcionalidades ya construidas | Backlog basado en pruebas reales y sin funciones duplicadas | [PR #549](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/549) | No certificado |
| 03 | Definir un caso de uso inicial vendible | Se ejecuta de principio a fin con datos de prueba | Sin evidencia verificada registrada | No certificado |
| 04 | Modelo de datos por empresa y sede | No hay filtraciones entre empresas ni sedes | [PR #551](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/551) | No certificado |
| 05 | Unificar estados y eventos | Cada cambio deja rastro y evita estados contradictorios | [PR #552](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/552) | No certificado |
| 06 | Calidad de datos y conciliaciones | Panel muestra diferencias y permite corregirlas de forma trazable | [PR #543](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/543) | No certificado |
| 07 | Motor determinista de cálculos | Pruebas unitarias de cálculos financieros e inventario | `core/finance/enterpriseMoneyOperations.js`, `routes/finanzas.js`, `test/gruk/p0-enterprise-financial-summary-http-scope.test.js`; [PR #557](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/557), [#558](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/558), [#559](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/559), [#560](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/560) fusionados; [#543](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/543), [#548](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/548) abiertos. Faltan persistencia real, conciliación e inventario E2E | Parcial, no certificado |
| 08 | Permisos y roles convencionales | Pruebas por rol deniegan acciones no autorizadas | Sin evidencia verificada registrada | No certificado |
| 09 | Bitácora externa de operaciones | Se reconstruye una transacción de punta a punta | Sin evidencia verificada registrada | No certificado |
| 10 | Tablero de salud del negocio | Los números coinciden con transacciones reales | Sin evidencia verificada registrada | No certificado |
| 11 | Pilotear con restaurantes reales | Existe evidencia de necesidad y feedback verificable | Sin evidencia verificada registrada | No certificado |
| 12 | Instrumentar métricas del producto | Hay panel semanal sin depender de estimaciones manuales | Sin evidencia verificada registrada | No certificado |
| 13 | Definir contratos de herramientas | Cada tool tiene esquema, pruebas, permisos y manejo de errores | Sin evidencia verificada registrada | No certificado |
| 14 | Lanzar un único agente inicial | Resuelve 20 casos de prueba mejor que búsqueda manual | Sin evidencia verificada registrada | No certificado |
| 15 | Separar hechos, hipótesis y recomendaciones | Nunca presenta hipótesis como hechos. | Sin evidencia verificada registrada | No certificado |
| 16 | GRUK Business State | Actualiza inventario/caja/pedidos tras eventos sin lag injustificado. | Sin evidencia verificada registrada | No certificado |
| 17 | Registro de objetivos (Goal Registry) | Se puede seguir y cerrar un objetivo con evidencia. | Sin evidencia verificada registrada | No certificado |
| 18 | Detección y priorización de oportunidades | Cada alerta explica cálculo, impacto y acción sugerida. | Sin evidencia verificada registrada | No certificado |
| 19 | Evaluador de resultados | Reportes de acierto, error, costo y correcciones. | Sin evidencia verificada registrada | No certificado |
| 20 | Verificación y aprobación humana | Pruebas demuestran que no hay pago/cambio irreversible sin permiso. | Sin evidencia verificada registrada | No certificado |
| 21 | ROI por flujo, no por cantidad de agentes | Caso piloto demuestra beneficio neto con supuestos declarados. | Sin evidencia verificada registrada | No certificado |
| 22 | Historial de eventos (Historical Lake) | Se puede reconstituir una situación histórica. | Sin evidencia verificada registrada | No certificado |
| 23 | Business Graph | Consultas cruzadas muestran dependencias reales. | Sin evidencia verificada registrada | No certificado |
| 24 | Memory Index y búsqueda con evidencia | Respuesta enlaza registros consultables. | Sin evidencia verificada registrada | No certificado |
| 25 | Memoria episódica | Caso pasado se recupera por similitud y fechas. | Sin evidencia verificada registrada | No certificado |
| 26 | Memoria semántica | Los hechos desactualizados se señalan. | Sin evidencia verificada registrada | No certificado |
| 27 | Memoria procedimental / skills | Skill se ejecuta únicamente en su ámbito válido. | Sin evidencia verificada registrada | No certificado |
| 28 | Memoria de fallos | El agente evita una repetición en evaluación histórica. | Sin evidencia verificada registrada | No certificado |
| 29 | Procedencia y autoridad de recuerdos | Resumen nunca amplía autorización del dato original. | Sin evidencia verificada registrada | No certificado |
| 30 | Caducidad, corrección y olvido | Dato revocado deja de influir en respuestas y búsquedas | Sin evidencia verificada registrada | No certificado |
| 31 | Memory Researcher bajo demanda | Acierto/costo superiores a la búsqueda simple en benchmarks internos | Sin evidencia verificada registrada | No certificado |
| 32 | Memoria jerárquica | Menos tokens sin degradar decisiones verificadas | Sin evidencia verificada registrada | No certificado |
| 33 | Memory Architect (investigación) | Cambios promocionados solo tras benchmark, revisión y rollback | Sin evidencia verificada registrada | No certificado |
| 34 | Representación de incertidumbre (Belief State) | Incidentes con datos contradictorios generan preguntas, no inventos | Sin evidencia verificada registrada | No certificado |
| 35 | Control Plane independiente | Todas las herramientas validan autorización en servidor | Sin evidencia verificada registrada | No certificado |
| 36 | Capability Registry | Agente de inventario no ve ni usa nómina o transferencias | Sin evidencia verificada registrada | No certificado |
| 37 | Execution Engine gobernado | Flujo fallido no duplica compras ni cobros | Sin evidencia verificada registrada | No certificado |
| 38 | Verificación posterior a cada acción | Acción se marca terminada solo con comprobación | Sin evidencia verificada registrada | No certificado |
| 39 | GRUK Core coordinador | Tarea transversal resuelta con rastro de decisiones | Sin evidencia verificada registrada | No certificado |
| 40 | Agente de inventario | Mejora KPI frente a línea base en piloto | Sin evidencia verificada registrada | No certificado |
| 41 | Agente de finanzas | Explica cifras y muestra fuentes de cada cálculo | Sin evidencia verificada registrada | No certificado |
| 42 | Agente de ventas | Recomendaciones conectadas a margen real | Sin evidencia verificada registrada | No certificado |
| 43 | Agente de compras y proveedores | Propuestas trazables y aprobadas antes de ejecutar | Sin evidencia verificada registrada | No certificado |
| 44 | Agente de operaciones y atención | Reduce tiempo de cierre de incidencias medido | Sin evidencia verificada registrada | No certificado |
| 45 | Agente de marketing | No envía campañas sin consentimiento/base jurídica aplicable | Sin evidencia verificada registrada | No certificado |
| 46 | Agente de RR. HH. limitado | Accesos diferenciados y sin decisiones laborales automáticas indebidas | Sin evidencia verificada registrada | No certificado |
| 47 | Delegación segura entre agentes | Un subagente nunca aumenta el límite del agente padre | Sin evidencia verificada registrada | No certificado |
| 48 | Agentes persistentes con seguimiento | Objetivo sobrevive a reinicio y pide humano si no puede avanzar | Sin evidencia verificada registrada | No certificado |
| 49 | Integraciones API y RPA cuando sea necesario | Conectores tienen versionado, fallbacks y auditoría | Sin evidencia verificada registrada | No certificado |
| 50 | Voz como interfaz opcional | Identificación y autorización equivalentes a interfaz escrita | Sin evidencia verificada registrada | No certificado |
| 51 | Business Simulator / Sandbox | Simula sin afectar clientes, dinero ni inventario real | Sin evidencia verificada registrada | No certificado |
| 52 | Experiment Engine | Experimento pequeño tiene criterio de éxito y parada | Sin evidencia verificada registrada | No certificado |
| 53 | Replay continuo de regresión | Versión nueva no empeora casos críticos | Sin evidencia verificada registrada | No certificado |
| 54 | Skill Factory | Skill supera baseline y pasa revisión | Sin evidencia verificada registrada | No certificado |
| 55 | Gestión de versiones de skills | Puede revertirse cualquier skill dañina | Sin evidencia verificada registrada | No certificado |
| 56 | Correcciones en tiempo de ejecución | Mejor recuperación en casos reproducibles | Sin evidencia verificada registrada | No certificado |
| 57 | Evaluación de agentes por tareas | Solo se agrega complejidad si hay mejora medible | Sin evidencia verificada registrada | No certificado |
| 58 | Atribución económica prudente | No se atribuye todo crecimiento a GRUK sin evidencia | Sin evidencia verificada registrada | No certificado |
| 59 | Model Router | Menor costo por éxito sin pérdida de calidad | Sin evidencia verificada registrada | No certificado |
| 60 | FinOps de inteligencia | Presupuesto y costos visibles por cliente/agente | Sin evidencia verificada registrada | No certificado |
| 61 | Autonomy Rate con calidad | Tasas respaldadas por muestras verificadas | Sin evidencia verificada registrada | No certificado |
| 62 | Reasoning Compression Ratio | Disminuye costo manteniendo desempeño | Sin evidencia verificada registrada | No certificado |
| 63 | Valor neto / ROII | Panel financiero defendible para cliente | Sin evidencia verificada registrada | No certificado |
| 64 | Apprentice Models | Primero predicen; luego proponen; solo ejecutan bajo umbrales validados | Sin evidencia verificada registrada | No certificado |
| 65 | Ejecución especulativa y local | Aceleración medida en tareas representativas | Sin evidencia verificada registrada | No certificado |
| 66 | Auto-mejora del harness | Cambio requiere pruebas y promoción humana | Sin evidencia verificada registrada | No certificado |
| 67 | Entrenamiento con lecciones validadas | Generaliza a datos nuevos sin empeorar seguridad | Sin evidencia verificada registrada | No certificado |
| 68 | Optimización de memoria autoajustable | Prueba A/B con precisión, latencia y costo | Sin evidencia verificada registrada | No certificado |
| 69 | Constitución operativa de GRUK | Pruebas de ataque no obtienen autoelevación | [PR #546](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/546), [PR #542](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/542) | No certificado |
| 70 | Aislamiento multiempresa | Pruebas negativas entre cuentas | Sin evidencia verificada registrada | No certificado |
| 71 | Protección frente a inyección y poisoning | Batería adversarial documentada | Sin evidencia verificada registrada | No certificado |
| 72 | Contención de ejecución | Kill switch operativo y probado | Sin evidencia verificada registrada | No certificado |
| 73 | Observabilidad independiente | Incidentes se investigan sin depender de memoria del agente | Sin evidencia verificada registrada | No certificado |
| 74 | Seguridad y privacidad por diseño | Revisión legal/seguridad antes de producción | [PR #547](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/547), [PR #546](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/546) | No certificado |
| 75 | Gobierno de cambios | Cada actualización puede probarse y revertirse | [PR #550](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/550), [PR #537](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/537) | No certificado |
| 76 | Gestión de incidentes y respuesta | Simulacro de incidente completado | Sin evidencia verificada registrada | No certificado |
| 77 | Seguridad de memoria y delegación | Pruebas de lavado de autoridad fallan | Sin evidencia verificada registrada | No certificado |

## Bloqueo de integración P1-75 (comprobado en PR #550)

Evidencia histórica 2026-11-05, commit `2f1e8f2e572b76323add4cdae2852bd99d36e9a2`: [GRUK CI](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41970174053), [gate empresarial](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41970174057) y [persistencia offline](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41970174041) SUCCESS; [quality gate](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41970174040) FAILURE. No es una aprobación integral; no fusionar #550 hasta resolver auditoría y volver a verificar el SHA actualizado.

### Verificación más reciente del PR #550 (2026-11-07)

HEAD `7b8fa504d1ed2729f22a3a2fdfd66b3dc2e88635`: [quality gate](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42132810159) **FAILURE**; [gate empresarial](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42132810151), [CI general](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42132810082) y [persistencia offline](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42132810116) **SUCCESS**. No fusionar con quality gate rojo; verificar causa en logs actuales antes de afirmar que es la misma vulnerabilidad histórica.

### Evidencia histórica anterior (no sustituye el estado actual)

- [Gate empresarial](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41943938583): SUCCESS en `f0784cba`.
- [CI general](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41943938576): SUCCESS.
- [Quality gate](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41943938629): FAILURE; vulnerabilidades HIGH en `follow-redirects` y `joi`.
- [Persistencia offline](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/41943938650): FAILURE; incompatibilidad de Playwright con Ubuntu 26.04. [PR #537](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/537) tiene evidencia de éxito en su propia rama, no está fusionado.

**Regla de promoción:** por cada ID transcribir criterio exacto, referenciar rutas de producción y tests, ejecutar pruebas negativas y E2E pertinentes, registrar URL de CI del SHA exacto y revisión; cambiar a certificado únicamente con evidencia completa. No fusionar cambios funcionales ni desplegar por este documento.
