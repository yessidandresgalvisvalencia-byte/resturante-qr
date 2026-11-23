# GRUK Empresarial — P0-02 inventario verificable (línea base)

Fuente de requisitos: `GRUK_Documentos_Unificados_Plan_Maestro.docx`, ítem **02 [P0]**. Este archivo es un registro de **evidencia estática**, no una certificación de funcionamiento ni de producción. No modifica GRUK Personal ni Blushea.

## Inventario inicial (lectura de `main`, 2026-11-22)

| Capacidad requerida | Evidencia de código/ruta | Estado verificable | Validación que falta |
| --- | --- | --- | --- |
| Pedidos QR | `routes/API.js`, `app.js` monta `/api`; `public/` servido estáticamente | Presencia de rutas; funcionalidad **no certificada** | Pedido QR → persistencia → transición → venta, E2E |
| Caja | `intelligence/listeners/caja.listener.js`, `app.js` registra listener | Integración declarada; **no certificada** | Cierre, concurrencia, conciliación con venta |
| Inventario | `routes/inventario.js` montado en `/api/inventario`; `routes/recetas.js` en `/api/recetas` | Rutas presentes; **no certificadas** | Descuento único, stock físico, empresa/sede |
| Cocina | No se constató endpoint específico en la lectura acotada de `app.js` | **Sin evidencia suficiente** | Localizar controlador y probar flujo |
| Facturación | `routes/facturacion.js` en `/api/facturacion` (legado); `core/facturacion/facturacion.routes.js` en `/api/facturacion-v2` | Dos montajes coexistentes; **no certificados** | Compatibilidad, no duplicación, factura vinculada a venta |
| Empleados | `routes/laboral.js` en `/laboral`, `routes/mensajesLaboral.js` en `/laboral/mensajes` | Rutas presentes; **no certificadas** | Autorización por empresa/sede y datos personales |
| Clientes | `routes/restaurants.js` en `/api/restaurants`, `routes/onboarding.js` en `/api/onboarding` | No prueba gestión de clientes finales | Localizar modelo, endpoints y pruebas de clientes |
| Finanzas | `routes/finanzas.js` en `/api/finanzas`; `intelligence/listeners/finanzas.listener.js` registrado | Integración declarada; **no certificada** | Ledger append-only, importes exactos, idempotencia, conciliación |

### Evidencia reproducible y límites

- `package.json`: `npm run gate` invoca `check:syntax` y `npm test`; `npm test` usa `node --test test/gruk/*.test.js`.
- `.github/workflows/ci.yml`: el quality gate configura Node 20, `npm ci`, `npm audit --omit=dev --audit-level=high`, MongoDB replica set y `npm run gate`. **La presencia de un workflow no demuestra que haya pasado en este commit.**
- Los montajes de rutas indicados se observaron directamente en `app.js` de `main`; no se inspeccionaron exhaustivamente controladores, permisos, modelos ni Render.
- Estado `terminado` queda prohibido hasta contar con ejecución real, aserciones y evidencia enlazada. Los estados `parcial`/`roto` requieren reproducir el comportamiento; sin prueba, usar `no certificado`.

## Matriz de trazabilidad del Plan Maestro (bloque P0 inicial)

| ID | Criterio de aceptación oficial | Código / evidencia conocida | Prueba necesaria | Decisión |
| --- | --- | --- | --- | --- |
| 01 | Aislamiento automatizado de datos y despliegues | PR #648: guardia de rutas | Negativas cross-product, credenciales y despliegue | Parcial; no aceptado |
| 02 | Backlog basado en pruebas reales, sin duplicados | Este inventario y `app.js` | Auditoría funcional de ocho capacidades y duplicados | Parcial; no aceptado |
| 03 | Pedido → venta → inventario → caja → reporte E2E | Rutas de API, inventario, finanzas | E2E con MongoDB aislado y aserciones de importes | No aceptado |
| 04 | Sin filtraciones entre empresas ni sedes | No evaluado aquí | Pruebas negativas de lectura/escritura por tenant/sede | No aceptado |
| 05 | Cada transición deja rastro y evita contradicciones | Listener de `VENTA_COMPLETADA` en `app.js` | Estados inválidos, reintentos y auditoría persistida | No aceptado |
| 06 | Panel de diferencias y corrección trazable | PR #647 en revisión previa | Reconciliación real, correcciones y UI | No aceptado |
| 07 | Pruebas unitarias de cálculos financieros e inventario | `npm test` configurado | Exactitud monetaria, IVA, costos, stock y concurrencia | No aceptado |

## Próximo bloque ejecutable

Construir pruebas de integración aisladas que ejecuten el flujo de pedido a reporte y fallen ante doble cargo, stock negativo, importes imprecisos o acceso entre empresas. Mantener CI y PR por bloque; no fusionar ni desplegar sin evidencia de la revisión y los checks del HEAD exacto.
