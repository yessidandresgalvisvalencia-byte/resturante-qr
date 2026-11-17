# GRUK Empresarial — trazabilidad P0-04 (en progreso)

Fuente normativa: `GRUK_Documentos_Unificados_Plan_Maestro.docx`, implementación **04**: normalizar Empresa, Sede, Usuario, producto, pedido, venta, pago, stock y proveedor con identificadores estables. **Aceptación:** no hay filtraciones entre empresas ni sedes.

> Estado: **NO CERTIFICADO**. Esta matriz no equivale a ejecución de pruebas ni certifica el resto de las 77 implementaciones.

| Criterio verificable | Código / evidencia de implementación | Prueba disponible | Estado y evidencia pendiente |
| --- | --- | --- | --- |
| Producto de otra empresa no puede asociarse a venta | `services/ventas.service.js`, consulta por `empresaId` | `test/gruk/p0-04-product-sede-scope.test.js` | Prueba con mocks; falta integración MongoDB real |
| Producto de sede hermana no puede asociarse a venta | `services/ventas.service.js`, filtro `sedeId` y catálogo global | `test/gruk/p0-04-product-sede-scope.test.js` | Falta matriz de 2 empresas × 2 sedes con documentos persistidos |
| Cliente de otra sede no puede asociarse a venta | `services/ventas.service.js`, filtro cliente | `test/gruk/p0-04-product-sede-scope.test.js` | Falta comprobar comportamiento con clientes históricos sin sede |
| Contexto del pedido no puede contradecir empresa/sede de la operación | `services/ventas.service.js` | `test/gruk/p0-04-order-context-tenant-guard.test.js` | Falta autorización HTTP por objeto y rol |
| Identificador de pedido requerido | `services/ventas.service.js` | `test/gruk/p0-04-order-id-required.test.js` | Falta comprobar idempotencia/concurrencia con persistencia real |
| Recuperación de duplicados no cruza empresas/sedes | `services/ventas.service.js` | `test/gruk/p0-04-duplicate-recovery-scope.test.js` | Falta prueba de índice único y carrera concurrente en MongoDB |
| Modelo completo Empresa/Sede/Usuario/producto/pedido/venta/pago/stock/proveedor | Múltiples modelos y rutas; sin auditoría exhaustiva aquí | No existe evidencia consolidada en este PR | Pendiente inventario de relaciones, índices y restricciones |
| No hay filtraciones en endpoints y sockets | Middleware, rutas y eventos no auditados integralmente aquí | No existe prueba E2E integral en este PR | Pendiente matriz de permisos por rol, API, Socket y sedes |
| Integración y liberación | PR #597; PR #596 potencialmente solapado | GitHub Actions vinculadas al SHA exacto del PR | Revalidar CI del HEAD, revisión independiente, pruebas reales y rollback antes de merge |

## Condiciones para cierre

1. Ejecutar tests de integración contra MongoDB real con al menos dos empresas, dos sedes por empresa y registros globales/históricos.
2. Probar autorización de lectura/escritura de endpoints y eventos con roles reales, incluyendo intentos de IDs ajenos.
3. Verificar idempotencia, índices únicos y concurrencia en venta/pago; registrar resultados reproducibles.
4. Confirmar que PR #596 y #597 no duplican ni revierten cambios funcionales; validar CI del HEAD exacto y obtener revisión independiente.
5. Registrar SHA, comandos, resultados y evidencia de CI/E2E. Fusionar solo con criterios aprobados. Sin despliegue automático a Render.

Rollback: revertir el merge identificado una vez integrado, tras verificar dependencias y efectos de datos; no modificar datos productivos sin plan aprobado.

## Evidencia verificada — 2026-11-17 (HEAD bf57a174ea7700b1bd24b6825b24e125f0070d53)

Consulta directa de GitHub Actions para el SHA exacto del PR #597:

| Verificación | Ejecución | Resultado observado | Alcance |
| --- | --- | --- | --- |
| GRUK CI | [44061742688](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44061742688) | `completed / success` | Solo workflow configurado, no certifica MongoDB multiempresa ni E2E |
| GRUK quality gate | [44061742682](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44061742682) | `completed / success` | No sustituye revisión independiente de seguridad |
| GRUK Offline Browser Persistence | [44061742672](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44061742672) | `completed / success` | No prueba aislamiento de endpoints/sockets |

**Bloqueo de integración:** este PR permanece sin certificación P0-04 hasta ejecutar la matriz persistida de 2 empresas × 2 sedes, pruebas de autorización por rol y objeto, concurrencia e idempotencia con índices MongoDB, E2E, revisión independiente y reconciliación del solapamiento con PR #596. Los resultados anteriores no autorizan merge ni despliegue. Los cálculos de `services/ventas.service.js` todavía usan `Number`; la exactitud financiera corresponde a P0-07 y no debe declararse cubierta por esta matriz.
