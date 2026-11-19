# GRUK Empresarial — evidencia de integración P0-04 / P0-07 / P0-70

Fuente de criterios: `GRUK_Documentos_Unificados_Plan_Maestro.docx` (backlog oficial 01–77). Este documento es una matriz parcial, no una certificación de los 77 requisitos.

| Requisito | Criterio oficial | Código observado en PR #605 | Prueba relacionada | Evidencia y estado |
|---|---|---|---|---|
| 04 · Modelo por empresa y sede | No hay filtraciones entre empresas ni sedes | `services/ventas.service.js`: rechazo de pedido con `empresaId`/`sedeId` incompatibles y filtro de producto por empresa | `test/gruk/ventaTenantReplay.test.js` | Pruebas de regresión en PR #605; **parcial**, sin E2E MongoDB de todas las entidades |
| 07 · Motor determinista | Pruebas unitarias de cálculos financieros e inventario | `core/finance/enterpriseSalesMath.js` y `services/ventas.service.js`: cálculo en centavos; `metadata.calculoExactoV1` | `test/gruk/ventaTenantReplay.test.js` y pruebas de motor financiero del PR | **Parcial**: `Venta` persiste importes históricos como `Number`; no hay ledger exacto certificado |
| 70 · Aislamiento multiempresa | Pruebas negativas entre cuentas | `services/ventas.service.js`: filtro `empresaId` en producto/cliente y rechazo temprano de ámbito | `test/gruk/ventaTenantReplay.test.js` | **Parcial**: cobertura de ventas, no de DB/cachés/búsquedas/archivos/logs completos |

## Evidencia CI (alcance estricto)

Commit `8aeb13471ffc5f279426caf2fcb94af0359f9765`: consulta de GitHub Actions el 19-11-2026 confirmó conclusión `success` en **GRUK CI**, **GRUK quality gate** y **GRUK Offline Browser Persistence**. Esto acredita solamente las verificaciones configuradas para ese commit; no equivale a E2E MongoDB, revisión de seguridad ni despliegue.

## Bloqueos y siguiente puerta de aceptación

1. Definir persistencia monetaria exacta con migración reversible y compatibilidad de documentos históricos; evitar convertir cantidades monetarias de vuelta a `Number` como fuente de verdad.
2. Ejecutar pruebas de integración MongoDB con dos empresas y dos sedes, reintentos concurrentes, índices únicos y conflictos económicos; verificar reconciliación con ventas y caja.
3. Auditar el índice de `Venta` basado en `origen`/`origenId` antes de alterar su ámbito: una modificación sin migración y verificación puede introducir duplicados.
4. Documentar revisión independiente de seguridad, rollback y pruebas E2E antes de autorizar merge o despliegue.

**Regla de promoción:** no marcar 04, 07 ni 70 como terminados ni desplegar hasta satisfacer todos sus criterios oficiales con evidencia reproducible. No tocar GRUK Finanzas Personales ni Blushea.
