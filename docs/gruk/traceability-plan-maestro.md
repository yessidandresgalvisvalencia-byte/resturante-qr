# GRUK Empresarial — matriz de trazabilidad verificable (incremental)

Fuente normativa: `GRUK_Documentos_Unificados_Plan_Maestro.docx` (biblioteca, versión 2026-10-09). Los identificadores 01–77 son estables. Esta matriz es **evidencia parcial**, no certificación de producto ni de despliegue.

## Política de evidencia

Cada criterio requiere: (1) requisito textual, (2) código en `main`, (3) test identificable, (4) ejecución CI exitosa del commit integrado, (5) revisión independiente, (6) evidencia E2E/seguridad cuando corresponda. Un PR abierto, incluso con CI verde, **no** cumple el criterio de integración. No marcar completado por mera existencia de un archivo o test.

| ID | Prioridad | Criterio oficial resumido | Código relacionado inspeccionado | Tests/PR propuestos | Evidencia y estado |
| --- | --- | --- | --- | --- | --- |
| 01 | P0 | Prueba automatizada de aislamiento de datos y despliegues entre GRUK empresarial y personal | No auditado aquí | Pendiente localizar pruebas de aislamiento | **No certificado** |
| 07 | P0 | Pruebas unitarias de cálculos financieros **e inventario** | `core/finance/enterpriseMoney.js`; `core/finance/enterpriseMoneyOperations.js` (funciones `lineTotal`, `invoiceTotal`, `taxAmount`, `reconcile`) | PR #586: `test/gruk/p0-07-tax-rounding-invariants.test.js`; #587: `test/gruk/p0-07-safe-boundary-invariants.test.js`; #588: `test/gruk/p0-07-invoice-metamorphic.test.js`; #589: `test/gruk/p0-07-finance-purity-contract.test.js`; #590: `test/gruk/p0-07-safe-cent-boundary.test.js` | **Parcial**: PR abiertos, sin certificación integrada de inventario ni E2E. Validar HEAD, CI y revisiones por PR antes de merge. |
| 69 | P0 | Pruebas de ataque no consiguen autoelevación | No auditado aquí | Pendiente batería adversarial | **No certificado** |
| 70 | P0 | Pruebas negativas entre cuentas para DB, cachés, búsquedas, archivos y logs | No auditado aquí | Pendiente suite multiempresa | **No certificado** |

## Cola de integración observada (2026-11-13)

PR #586–#590: todos asociados a la porción financiera de 07; evitar duplicar pruebas o declarar el requisito completo. También existen PR de seguridad empresarial #579 y #582 y un cambio financiero #580, sujetos a su propia revisión. El estado de CI/revisión debe consultarse **de nuevo** en el SHA exacto antes de fusionar; esta tabla no sustituye esa comprobación.

## Próxima secuencia de ejecución

1. Revisar interdependencias y posibles solapamientos de #586–#590 contra el `main` más reciente; integrar solo PR con CI vigente, revisión independiente y compatibilidad comprobada.
2. Identificar el código real de movimientos de inventario y crear tests de invariantes de stock, no negativos, reversos, concurrencia e idempotencia según contratos existentes (sin inventar API).
3. Ampliar la matriz a **todos** los ID 01–77 leyendo el documento completo; mantener `no auditado` donde no exista evidencia.
4. Ejecutar E2E por empresa/sede, revisión de seguridad y rollback antes de cualquier despliegue. No modificar GRUK Finanzas Personales ni Blushea.

**Bloqueos:** revisión independiente pendiente en PR financieros según la última verificación registrada; inventario y E2E no certificados. No autoriza despliegue a Render.
