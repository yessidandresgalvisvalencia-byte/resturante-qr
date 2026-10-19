# GRUK Finanzas Personales — integración segura con main

## Estado comprobado (19 de octubre de 2026, hora de Colombia: 18 de octubre)
El diagnóstico de Git `git merge-tree --write-tree --name-only --messages origin/main origin/feature/finanzas-personales` detecta cinco conflictos: `.github/workflows/ci.yml`, `.github/workflows/gruk-ci.yml`, `app.js`, `package.json`, `package-lock.json`. La rama personal se despliega **independientemente** en Render; la existencia de conflictos no demuestra fallo de su producción. El CI general falla deliberadamente para advertir que la fusión todavía no es segura.

## Reglas no negociables
1. No realizar `git merge` ni `git push` sobre `main` mientras existan conflictos sin revisión y ambas suites no hayan pasado.
2. No reemplazar ciegamente la versión empresarial de `app.js`, el `package.json`, ni los workflows por versiones de la rama personal.
3. No usar bases de datos ni credenciales productivas en pruebas. Usar MongoDB local aislado y cuentas sintéticas.
4. Preservar despliegues independientes: GRUK Empresarial no debe apuntar a rutas/módulos personales salvo diseño explícito; GRUK Personal debe iniciar mediante `npm run start:personal`.
5. Verificar que el código de cada producto y sus datos, rutas, autenticación y canales de Socket.IO se mantengan aislados.

## Matriz de resolución por archivo

| Archivo | Motivo del conflicto | Criterio de resolución |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Workflows de controles distintos creados o modificados en ambas ramas | Mantener validación de producción empresarial, conservar gates personales y evitar workflows duplicados con acciones contradictorias |
| `.github/workflows/gruk-ci.yml` | La rama personal incorporó diagnóstico de fusión y condiciones de checkout propias | Mantener gate empresarial y diagnóstico real de merge; no modificar el resultado a verde mientras haya conflictos |
| `app.js` | Entradas compartidas para Express y Socket.IO | Revisar bloque a bloque los montajes; conservar rutas empresariales y montar las personales solo con las restricciones y autenticación adecuadas |
| `package.json` | Scripts y dependencias distintos | Conciliar scripts de inicio y prueba de ambos productos, manteniendo versiones instalables y las revisiones de seguridad |
| `package-lock.json` | Dependencias/árbol de resolución divergentes | Regenerar desde el package.json reconciliado con npm; no elegir un lado a ciegas |

## Procedimiento para rama de integración aislada (no ejecutado todavía)
1. Crear una rama temporal desde el último `main`, no desplegable; registrar SHA de ambas puntas y el merge-base.
2. Realizar resolución manual de los cinco archivos dentro de esa rama aislada, preservando `main` y `feature/finanzas-personales`.
3. Ejecutar `npm ci`, `npm run check:syntax`, `npm test`, `npm run gate` y el workflow `GRUK Finanzas Personales - Seguridad y Pruebas`, incluyendo MongoDB replica set aislado.
4. Revisar rutas, cookies/token/sesiones, sockets, variables de entorno y ausencia de accesos entre tenants. Validar arranque de ambos productos por separado.
5. Exigir revisión de diferencias, PR y validación positiva antes de integrar a `main` — nunca fusionar automáticamente.
6. Comprobar en cada Render service su rama configurada, commit publicado y salud; no usar un despliegue del servicio personal como evidencia del empresarial.

## Fuente de verdad
El diagnóstico automatizado es `scripts/diagnose-personal-merge.sh`. Devuelve código 1 con conflictos; esto **no debe relajarse** solo para obtener un CI verde. Las pruebas financieras especializadas pueden pasar independientemente y no sustituyen la validación de la fusión.
