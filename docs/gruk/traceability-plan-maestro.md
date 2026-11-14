# GRUK Empresarial — matriz de trazabilidad verificable (incremental)

Fuente normativa: `GRUK_Documentos_Unificados_Plan_Maestro.docx` (biblioteca, versión 2026-10-09). Los identificadores 01–77 son estables. Esta matriz es **evidencia parcial**, no certificación de producto ni de despliegue.

## Política de evidencia

Cada criterio requiere: (1) requisito textual, (2) código en `main`, (3) test identificable, (4) ejecución CI exitosa del commit integrado, (5) revisión independiente, (6) evidencia E2E/seguridad cuando corresponda. Un PR abierto, incluso con CI verde, **no** cumple el criterio de integración. No marcar completado por mera existencia de un archivo o test.

| ID | Prioridad | Criterio oficial resumido | Código relacionado inspeccionado | Tests/PR propuestos | Evidencia y estado |
| --- | --- | --- | --- | --- | --- |
| 01 | P0 | Prueba automatizada de aislamiento de datos y despliegues entre GRUK empresarial y personal | No auditado aquí | Pendiente localizar pruebas de aislamiento | **No certificado** |
| 02 | P0 | Inventario de funciones QR, caja, inventario, cocina, facturación, empleados, clientes y finanzas, con estado terminado/parcial/roto basado en pruebas | No auditado aquí | Pendiente inventario contrastado con tests | **No certificado** |
| 03 | P0 | Flujo pedido → venta → descuento de inventario → caja → reporte ejecutado E2E con datos de prueba | No auditado aquí | Pendiente E2E integral | **No certificado** |
| 04 | P0 | Modelo Empresa/Sede/Usuario/producto/pedido/venta/pago/stock/proveedor con IDs estables; sin filtraciones entre empresas ni sedes | No auditado aquí | Pendiente pruebas negativas de tenant y sede | **No certificado** |
| 05 | P0 | Estados y transiciones de pedidos, pagos, inventario, devoluciones y entregas trazables y sin contradicciones | No auditado aquí | Pendiente tests de transiciones inválidas y auditoría | **No certificado** |
| 06 | P0 | Validar duplicados, movimientos sin soporte, conciliación caja/ventas y stock físico; panel de diferencias y corrección trazable | No auditado aquí | Pendiente conciliación y pruebas de correcciones | **No certificado** |
| 07 | P0 | Pruebas unitarias de cálculos financieros **e inventario** | `core/finance/enterpriseMoney.js`; `core/finance/enterpriseMoneyOperations.js` (funciones `lineTotal`, `invoiceTotal`, `taxAmount`, `reconcile`) | PR #592: `test/gruk/p0-07-tax-base-policy.test.js`; #586: `test/gruk/p0-07-tax-rounding-invariants.test.js`; #587: `test/gruk/p0-07-safe-boundary-invariants.test.js`; #588: `test/gruk/p0-07-invoice-metamorphic.test.js`; #589: `test/gruk/p0-07-finance-purity-contract.test.js`; #590: `test/gruk/p0-07-safe-cent-boundary.test.js` | **Parcial**: PR abiertos, sin certificación integrada de inventario ni E2E. Validar HEAD, CI y revisiones por PR antes de merge. |
| 08 | P0 | Pruebas por rol deniegan acciones no autorizadas para dueño, gerente, cajero, inventario, cocina, contador y administrador | No auditado aquí | Pendiente matriz de permisos y tests de denegación por rol | **No certificado** |
| 09 | P0 | Reconstrucción completa de una transacción con bitácora externa (actor, origen, hora, antes/después y resultado) | No auditado aquí | Pendiente prueba de trazabilidad extremo a extremo y resistencia a edición por agentes | **No certificado** |
| 10 | P0 | Tablero de salud: cifras y KPIs coinciden con transacciones reales reconciliadas | No auditado aquí | Pendiente contrastar dashboard con ledger y ventas verificadas | **No certificado** |
| 11 | P0 | Piloto con 3–5 restaurantes y evidencia verificable de necesidad, fricciones y feedback | No auditado aquí | Pendiente evidencia de campo y línea base de tiempo, errores y costos | **No certificado** |
| 12 | P0 | Panel semanal automatizado de usuarios activos, pedidos válidos, errores, tiempo por tarea y retención | No auditado aquí | Pendiente tests de instrumentación y validación del panel | **No certificado** |
| 13 | P0 | Cada herramienta tipada de ventas, stock, margen, órdenes, proveedores y facturas tiene esquema, pruebas, permisos y errores estructurados | No auditado aquí | Pendiente inventario de contratos y pruebas de autorización y errores | **No certificado** |
| 14 | P0 | Agente supervisor de solo lectura explica diferencias de ventas/inventario con citas internas; supera búsqueda manual en 20 casos | No auditado aquí | Comparativa de 20 casos, no mutación de datos y citas verificables | **No certificado** |
| 15 | P0 | Hechos, hipótesis y recomendaciones distinguidos; jamás presentar hipótesis como hechos | No auditado aquí | Casos adversariales de etiquetado de certeza, procedencia y datos faltantes | **No certificado** |
| 16 | P1 | Estado empresarial por empresa/sede actualiza inventario, caja y pedidos tras eventos sin retraso injustificado | No auditado aquí | Pruebas de frescura temporal, procedencia y aislamiento por sede | **No certificado** |
| 17 | P1 | Objetivo con dueño, horizonte, línea base, KPI, presupuesto, estado y autorización; seguimiento y cierre evidenciables | No auditado aquí | Ciclo de vida y autorización de objetivo con evidencia | **No certificado** |
| 18 | P1 | Alertas de faltantes, desperdicio, descuadre, margen y atrasos explican cálculo, impacto y acción sugerida | No auditado aquí | Casos reproducibles de umbrales y cálculo de impacto | **No certificado** |
| 19 | P1 | Evaluación de predicciones y propuestas frente a resultados con reportes de error, acierto, costo y corrección | No auditado aquí | Comparación contra resultado real sin atribución causal automática | **No certificado** |
| 20 | P1 | Acciones sensibles solo desde borrador con confirmación humana explícita; no pagos ni cambios irreversibles sin permiso | No auditado aquí | Pruebas negativas de pago/cambio irreversible sin autorización | **No certificado** |
| 69 | P0 | Pruebas de ataque no consiguen autoelevación | No auditado aquí | Pendiente batería adversarial | **No certificado** |
| 70 | P0 | Pruebas negativas entre cuentas para DB, cachés, búsquedas, archivos y logs | No auditado aquí | Pendiente suite multiempresa | **No certificado** |

| 71 | P1 | Batería adversarial documentada contra inyección y poisoning en documentos, correos, tools y memoria | No auditado aquí | Pendiente suite de entradas no confiables y pruebas de autoridad | **No certificado** |
| 72 | P1 | Kill switch operativo y probado; sandbox, límites de red, credenciales efímeras y rate limits | No auditado aquí | Pendiente prueba de detención y contención | **No certificado** |
| 73 | P1 | Incidentes investigables con logs externos y auditoría independiente, sin memoria del agente | No auditado aquí | Pendiente prueba de correlación y retención de evidencias | **No certificado** |
| 74 | P1 | Revisión legal y de seguridad previa a producción: retención mínima, consentimiento, acceso y eliminación trazable | No auditado aquí | Pendiente revisión formal y pruebas de privacidad | **No certificado** |
| 75 | P1 | Actualizaciones probables y reversibles con CI/CD, staging, control de versiones y aprobación | No auditado aquí | Pendiente ejercicio de rollback y evidencia de aprobación | **No certificado** |
| 76 | P2 | Simulacro de incidente completado: bloqueo, notificación, revisión de logs y restauración | No auditado aquí | Pendiente simulacro con tiempos y resultados | **No certificado** |
| 77 | P2 | Pruebas de lavado de autoridad fallan; validar autoridad original en resúmenes y subagentes | No auditado aquí | Pendiente pruebas adversariales de delegación | **No certificado** |

## Cola de integración observada (2026-11-13)

PR #586–#590, #592 y #593: todos asociados a la porción financiera de 07; evitar duplicar pruebas o declarar el requisito completo. También existen PR de seguridad empresarial #579 y #582 y un cambio financiero #580, sujetos a su propia revisión. El estado de CI/revisión debe consultarse **de nuevo** en el SHA exacto antes de fusionar; esta tabla no sustituye esa comprobación.

## Próxima secuencia de ejecución

1. Revisar interdependencias y posibles solapamientos de #586–#590 contra el `main` más reciente; integrar solo PR con CI vigente, revisión independiente y compatibilidad comprobada.
2. Identificar el código real de movimientos de inventario y crear tests de invariantes de stock, no negativos, reversos, concurrencia e idempotencia según contratos existentes (sin inventar API).
3. Ampliar la matriz a **todos** los ID 01–77 leyendo el documento completo; mantener `no auditado` donde no exista evidencia.
4. Ejecutar E2E por empresa/sede, revisión de seguridad y rollback antes de cualquier despliegue. No modificar GRUK Finanzas Personales ni Blushea.

**Bloqueos:** revisión independiente pendiente en PR financieros según la última verificación registrada; inventario y E2E no certificados. No autoriza despliegue a Render.
