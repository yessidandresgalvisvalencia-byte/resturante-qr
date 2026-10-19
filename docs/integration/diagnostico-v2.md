# Evidencia de integración GRUK — candidato V2

Fecha de diagnóstico: 2026-10-18 (Colombia).
Origen empresarial `main`: `e967a8a30c8ed9a6df2ee2d1b536672c8aea860f`.
Origen personal `feature/finanzas-personales`: `142ef903677aa4891916944df70a0bf38e5dcb61`.
Rama de pruebas: `integration/finanzas-personales-safe-20261018-v2`.
Workflow: `GRUK Integration Preflight (read only)`, ejecución [39193372448](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/39193372448).

## Resultado comprobado
El control Git verificó que ambos SHA corresponden a los valores esperados, ejecutó `git merge-tree --write-tree --name-only --messages` y salió con código 1 por cinco conflictos:
- `.github/workflows/ci.yml` (add/add);
- `.github/workflows/gruk-ci.yml` (content);
- `app.js` (content);
- `package-lock.json` (content);
- `package.json` (content).

El job publicó evidencia incluso al fallar. **El fallo es correcto**: impedir una integración no examinada es una barrera de seguridad, no una suite financiera defectuosa.

## Puertas para la siguiente resolución
1. Resolver `app.js` conservando rutas y sockets de ambos productos, y probar endpoints por separado.
2. Conciliar `package.json` y regenerar su `package-lock.json` con npm. Exigir `npm ci` reproducible.
3. Unificar criterios de los dos workflows sin eliminar los controles empresariales ni financieros.
4. Ejecutar `npm run gate` de la rama resultante y las pruebas financieras con MongoDB replica set aislado.
5. Verificar en Render que las dos aplicaciones se despliegan desde las ramas correctas.
6. No modificar ni fusionar `main` sin pruebas completas y revisión de diferencias.

## Estado
**BLOQUEADO / no apto para merge**. Ninguno de los cinco conflictos ha sido resuelto todavía. No contiene un merge, no cambia saldos, y no necesita credenciales productivas.
