# GRUK · Resolución asistida de app.js (candidato V3)

**Estado:** PARCIAL — validación de contrato, NO fusión ni versión desplegable.

## Referencias fijadas
- `main`: `855893d1438c0a32ac10dee2c6d7ee04014ee22c`
- `feature/finanzas-personales`: `142ef903677aa4891916944df70a0bf38e5dcb61`
- Esta rama está basada en `main` y conserva su `app.js` sin alteraciones.

## Conflicto estudiado: app.js
La rama empresarial ya usa `registerHttpHealthRoutes(app,mongoose,{version:require("./package.json").version})`, un módulo reutilizable con `Cache-Control: no-store` y estado 503 cuando la base de datos está desconectada. La rama personal contiene una definición inline anterior de `/ready` y `/health`. La eventual fusión **deberá mantener el registro modular de main**; copiar la variante antigua de la rama personal produciría una regresión.

Las rutas empresariales `/api/restaurants`, `/api/facturacion-v2`, `/api/inventario`, `/api` y la autenticación por token de Socket.IO no pueden desaparecer ni relajarse.

## Verificación real
Workflow [GRUK Integration Contract V3](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39193973390): **success**. Ejecuta `node --check app.js` y `node --test test/gruk/integration-health-contract.test.js`, incluida simulación de MongoDB desconectado/conectado.

## Pendientes para declarar integración
- Importar y revisar el módulo personal completo sin rutas ni datos cruzados.
- Conciliar `package.json` y `package-lock.json` y ejecutar `npm ci`.
- Resolver los dos workflows CI y mantener el diagnóstico de conflictos como fail-closed.
- Ejecutar pruebas empresariales y personales juntas, con MongoDB aislado, antes de plantear PR y despliegue.

**No apto todavía para merge ni despliegue.** Los cinco conflictos de Git siguen sin resolverse; aprobar el contrato de salud únicamente confirma que no se perdió una garantía existente de `main`.
