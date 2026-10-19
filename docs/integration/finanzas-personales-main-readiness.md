# GRUK · Integración aislada Finanzas Personales / Empresarial

**Estado:** CANDIDATA SIN FUSIONAR — NO DESPLEGAR.

## SHA de referencia (capturados 2026-10-18 Colombia)
- `main`: `66194960e0b5b2c02ffdea06cfa369db0d218da8`
- `feature/finanzas-personales`: `142ef903677aa4891916944df70a0bf38e5dcb61`
- Esta rama fue creada **desde main**, sin ejecutar `git merge` y sin incluir aún el código del módulo personal.
- Para comenzar una resolución, volver a comprobar ambos SHA; si cambiaron, el diagnóstico queda obsoleto.

## Conflictos conocidos (Git merge-tree)
1. `.github/workflows/ci.yml` — controles de calidad empresarial y personal.
2. `.github/workflows/gruk-ci.yml` — gate empresarial y reporte de merge bloqueado.
3. `app.js` — rutas y sockets compartidos.
4. `package.json` — scripts, runtime y dependencias.
5. `package-lock.json` — árbol lock reconciliado por npm.

## Puertas antes de fusionar
- Generar candidato de fusión **solo en esta rama** y revisar todas las diferencias; nunca copiar a ciegas una versión de `main` o personal.
- Conservar arranque empresarial y personal por separado; verificar que `main` y su servicio Render no cambien.
- Regenerar lockfile del `package.json` reconciliado y correr `npm ci`.
- Ejecutar suites empresariales y personales, MongoDB replica set aislado, diagnósticos de seguridad, autorización por usuario e idempotencia.
- Revisar alcance de credenciales/secrets, cookies, endpoints y canales Socket.IO; pruebas de aislamiento entre módulos.
- Mantener CI de diagnóstico como **fallido** mientras `git merge-tree` informe conflictos.
- Exigir revisión de la diferencia final y validación positiva explícita antes de abrir el camino a `main`.

## Veredicto actual
**NO APTO PARA FUSIÓN.** Esta rama es un espacio seguro de preparación, no una integración completada. No presupone que los cambios personales sean compatibles con las 244 confirmaciones exclusivas de `main`.


## Advertencia de deriva detectada
Tras crear esta rama, `main` avanzó de `66194960e0b5b2c02ffdea06cfa369db0d218da8` a `e967a8a30c8ed9a6df2ee2d1b536672c8aea860f` durante la misma sesión. **Esta candidatura está obsoleta y debe permanecer bloqueada.** No actualizar los SHA esperados ni reinterpretar el archivo base como compatible: se debe generar otra candidatura desde el nuevo `main`, diagnosticar conflictos nuevamente y repetir las pruebas. No fue un cambio realizado sobre `main` por esta tarea.
