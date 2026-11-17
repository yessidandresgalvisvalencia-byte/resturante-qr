# GRUK Empresarial — trazabilidad del requisito 04 (P0)

Fuente: `GRUK_Documentos_Unificados_Plan_Maestro.docx`, implementación 04: «Modelo de datos por empresa y sede». Criterio oficial: «No hay filtraciones entre empresas ni sedes».

> Estado: **parcial / NO certificado**. Esta matriz identifica evidencias existentes y verificaciones aún necesarias; los tests con dobles no demuestran aislamiento real en MongoDB ni autorización HTTP.

| Criterio verificable | Código / cambio bajo revisión | Evidencia automatizada | Pendiente para aceptar |
| --- | --- | --- | --- |
| Producto consultado dentro de empresa y sede, admitiendo catálogo global explícito | `services/ventas.service.js`, `ProductoServicio.findOne` | Pruebas P0-04 en `test/gruk/` | MongoDB real con dos empresas y dos sedes; probar catálogo global y producto de otra sede |
| Pedido, cliente y venta no atraviesan límites de tenant | `services/ventas.service.js` | Regresiones P0-04 de aislamiento y recuperación de duplicados | HTTP autenticado con roles, tenant malicioso y acceso cruzado; validar modelos y endpoints relacionados |
| Reintento de venta no duplica transacción ni evento | `services/ventas.service.js`, recuperación de `11000` | `p0-04-duplicate-replay-state-conflict.test.js`, `p0-04-idempotent-replay-no-event.test.js`, `p0-04-postcreate-event-duplicate-propagation.test.js` | Índice único efectivo y carrera concurrente con MongoDB; comprobar atomicidad y outbox/eventos |
| Venta rechaza importes ausentes, booleanos o formatos no decimales | `services/ventas.service.js` | `p0-04-missing-economic-fields.test.js`, `p0-04-boolean-economic-fields.test.js`, `p0-04-nondecimal-economic-fields.test.js` | Verificar precisión monetaria: actualmente se usa `Number` y multiplicación en punto flotante; no declarar ledger decimal seguro |
| Unicidad por tenant, sede, origen y pedido | PR #596 (migración e índices) y PR #597 (servicio) | Revisar CI de cada HEAD, no solo commits anteriores | Coordinar migración, inspeccionar índices reales, resolver colisiones históricas, revisar compatibilidad de ambas ramas |

## Puertas de salida obligatorias

1. Integrar PR #596 y #597 sin conflictos, con revisión independiente y CI verde del **HEAD exacto** de cada PR.
2. Ejecutar integración real en MongoDB con dos empresas, dos sedes, clientes y productos, incluyendo accesos adversariales y concurrencia.
3. Probar endpoints HTTP autenticados, flujo pedido → venta → inventario → caja → reporte y ausencia de doble evento financiero.
4. Registrar comandos, dataset anonimizado, resultados, logs y SHA de commit de cada evidencia.
5. Revisar seguridad, rollback y efectos sobre otras aplicaciones; mantener fuera del alcance GRUK Personal y Blushea.

**No fusionar ni desplegar** basándose únicamente en las pruebas unitarias con mocks o en CI de un commit anterior. La aceptación final exige evidencia independiente y verificable.

## Evidencia de CI del commit 775dee5 — 2026-11-17

GitHub Actions devolvió tres ejecuciones con `status=completed` y `conclusion=success` asociadas exactamente al HEAD `775dee5bd5ecec6ff4f681fee706532170d5ad41`:

- [GRUK CI #44071010178](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44071010178)
- [GRUK quality gate #44071010265](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44071010265)
- [GRUK Offline Browser Persistence #44071010312](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44071010312)

Estos resultados **no** acreditan MongoDB real, pruebas HTTP multiempresa, E2E, revisión de seguridad ni revisión humana. Los PR #596 y #597 siguen abiertos y en borrador. La modificación de este documento crea un nuevo HEAD que necesita su propia verificación de CI. No fusionar ni desplegar.
