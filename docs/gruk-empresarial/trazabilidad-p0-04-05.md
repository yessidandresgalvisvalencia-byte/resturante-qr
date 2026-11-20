# GRUK Empresarial — trazabilidad P0 04/05 (11-11-2026)

Fuente oficial: `GRUK_Documentos_Unificados_Plan_Maestro.docx`, implementaciones 04 y 05. Este registro **no certifica** cumplimiento.

| ID | Criterio oficial | Código a auditar | Prueba exigida | Evidencia / estado |
|---|---|---|---|---|
| P0-04 | No hay filtraciones entre empresas ni sedes; IDs estables en Empresa, Sede, Usuario, producto, pedido, venta, pago, stock y proveedor | `models/pedido.js`; rutas de sincronización offline; modelos de las demás entidades por inventariar | JWT real de dos empresas y dos sedes, lectura/escritura cruzada denegada, actualizaciones masivas, concurrencia y persistencia MongoDB | PARCIAL: controles offline descritos en PR #563; no se certificó el conjunto de entidades ni E2E |
| P0-05 | Cada cambio de estado deja rastro y evita estados contradictorios en pedido, pago, inventario, devolución y entrega | `models/pedido.js`; handlers de transición y auditoría por inventariar | Matriz de transiciones válidas/inválidas, doble petición concurrente, actor/fecha/origen y reconstrucción de eventos por empresa/sede | PARCIAL: no hay evidencia integral verificable |
| Seguridad de entrega | Dependencias sin vulnerabilidades altas conocidas y CI verde | `package.json`, `package-lock.json`, workflows | `npm ci`, `npm audit`, suite CI y Docker sobre el mismo SHA | BLOQUEADO: PR #563 registró fallas quality gate / Offline Contract; requiere verificar versión resuelta de Mongoose y actualizar lockfile reproduciblemente |

## Control de cambios

- PR de implementación existente: https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/pull/563
- No fusionar #563 mientras existan verificaciones fallidas o no se haya revisado la corrección de seguridad.
- No considerar una declaración semver como prueba de la versión instalada: contrastar `package-lock.json` y `npm ci`.
- La presente rama modifica únicamente documentación de GRUK Empresarial; no toca Finanzas Personales ni Blushea.
- Antes de cerrar P0-04/P0-05: adjuntar SHA de código, comandos y salidas de pruebas, URL de cada workflow, resultados de MongoDB/JWT, revisión de seguridad y decisión de aceptación.
- No desplegar a Render hasta satisfacer los criterios globales de los 77 requisitos y la validación de producción.
