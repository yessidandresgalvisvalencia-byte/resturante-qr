# GRUK Empresarial — trazabilidad verificable (Plan Maestro 01–77)

Fuente de verdad: `GRUK_Documentos_Unificados_Plan_Maestro.docx` (9-oct-2026). Esta matriz no acredita implementación por mera existencia de PR o CI. Un requisito se cierra solo con cada criterio de aceptación probado y evidencia enlazada. No modificar GRUK Finanzas Personales ni Blushea.

| ID | Prioridad | Criterio oficial de aceptación | Código / PR candidato | Pruebas y evidencia | Estado |
|---|---|---|---|---|---|
| 01 | P0 | Prueba automatizada de aislamiento de datos y despliegues empresarial/personal | Pendiente de inventario | Sin evidencia integral | No certificado |
| 02 | P0 | Inventario basado en pruebas reales, sin duplicados | Pendiente | Sin evidencia integral | No certificado |
| 03 | P0 | Pedido → venta → inventario → caja → reporte E2E con datos de prueba | PR #610 (candidato parcial) | E2E integral pendiente | No certificado |
| 04 | P0 | Sin filtraciones entre empresas ni sedes | PR #610 (ventas, HTTP, Socket), PR #616 (auditoría manual); #614 superpuesto | #616 HEAD `19c28a1`: GRUK CI [44742916626](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44742916626), quality [44742916612](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44742916612), offline [44742916600](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44742916600), exitosos; pruebas negativas Mongo/HTTP/Socket y revisión independiente pendientes | Parcial, no certificado |
| 05 | P0 | Transiciones de estado trazables, sin contradicciones | Pendiente de inventario | Sin evidencia integral | No certificado |
| 06 | P0 | Conciliación caja/ventas/stock con diferencias y corrección trazable | Pendiente de inventario | Sin evidencia integral | No certificado |
| 07 | P0 | Pruebas unitarias de cálculos financieros e inventario | `core/finance/enterpriseMoney.js`, PR #612, PR #606 | CI y conciliación financiera integral pendientes de acreditar | Parcial, no certificado |
| 69 | P0 | Pruebas de ataque sin autoelevación de autoridad | Pendiente | Sin evidencia integral | No certificado |
| 70 | P0 | Pruebas negativas entre cuentas en DB, cachés, búsquedas, archivos y logs | PR #610 (candidato parcial) | Batería completa pendiente | No certificado |
| 75 | P1 | Cada actualización probada y reversible | Workflows existentes; PR #617 respaldo/restore | Gate de producción, rollback y simulacro pendientes | No certificado |

## Regla de actualización
1. Completar las filas 08–68 y 71–77 transcribiendo literalmente los criterios del Word antes de declararlos terminados; no inferirlos de títulos o PR.
2. Para cada criterio: anotar rutas de código, prueba reproducible, SHA exacto, ejecución CI, resultado E2E y revisión de seguridad cuando corresponda.
3. Diferenciar `sin evidencia`, `parcial`, `bloqueado` y `certificado`. CI verde no equivale a aceptación de negocio ni a seguridad E2E.
4. Mantener PR #616 y #614 sin fusionar hasta resolver superposición; actualizar contra main y ejecutar gates del nuevo HEAD.
5. Render: no desplegar hasta 77/77 certificados, E2E, seguridad, rollback y autorización del servicio correcto; verificar URL y HTTP 200 de /health.

Esta entrega establece una matriz inicial, no certifica 77/77 ni sustituye la revisión completa del documento.
