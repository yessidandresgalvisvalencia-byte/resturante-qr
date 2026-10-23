# Evolución GRUK — 2026-10-14: Aislamiento de inventario por sede

## Título
Autorización por objeto y sede en creación, consulta y anulación de inventario.

## Fuente
- URL: https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/
- Fecha: 2023, consultado 2026-10-14
- Tipo: estándar

## Hallazgo externo
OWASP recomienda verificar el permiso del usuario autenticado sobre cada objeto de API.

## Estado actual de GRUK
Revisión de `main` (921a1c6): `routes/inventario.js` filtra GET por empresa y restaurante pero no sede; PUT anular filtra por _id y empresa y acepta `usuario` desde el cliente; POST acepta propiedades de alcance desde el cuerpo. `models/Inventario.js` tiene sedeId opcional; `core/auth/auth.middleware.js` proporciona rol, empresa, sede y usuario autenticados.

## Brecha
Posible acceso o modificación de inventario de otra sede de la misma empresa. Análisis estático, sin explotación demostrada.

## Decisión
IMPLEMENTAR AHORA

## Cambio propuesto
1. Definir compatibilidad para inventario histórico con sedeId nulo.
2. Validar empresa, restaurante y sede desde identidad autenticada.
3. Limitar campos permitidos en POST.
4. Aplicar filtro de sede en GET antes de totales y paginación.
5. Filtrar PUT por sede y anulado:false y atribuir usuario de anulación a req.auth.usuarioId.

## Riesgo de producción
MEDIO: puede cambiar visibilidad de registros históricos o flujos legítimos.

## Pruebas obligatorias
Dos empresas y dos sedes; roles DUEÑO, ADMIN_SEDE y EMPLEADO; POST, GET, PUT, ID manipulado, usuario manipulado, datos históricos, paginación, totales y npm run gate.

## Criterio de éxito
Aislamiento entre empresas y sedes demostrado; usuario de anulación verificable; sin regresiones de frontend, inventario histórico ni CI.

## Restricciones
No hacer merge a main ni desplegar producción automáticamente.

## Seguimiento del 2026-10-23

Revalidado contra `main` `221a78c21e2b60a1935e056c3c901a3ad2a8356f`:
- `routes/inventario.js` sigue sin aplicar `sedeId` en la consulta de inventario y en la anulación por objeto.
- `PUT /anular/:id` todavía acepta `usuario` del cuerpo en lugar de derivarlo de `req.auth.usuarioId`; no exige `anulado:false` en el filtro de actualización.
- `POST /` copia el cuerpo antes de fijar empresa y no valida integralmente la relación restaurante/sede.
- `models/Inventario.js` permite `sedeId:null`; definir compatibilidad histórica antes de filtrar registros existentes.
- No se ha demostrado explotación ni se han realizado cambios funcionales en esta rama.

**Próxima acción:** diseñar tests HTTP + MongoDB de acceso cruzado, anulación repetida y compatibilidad histórica; abrir PR en borrador solo con cambios probados. No merge ni despliegue automático.
