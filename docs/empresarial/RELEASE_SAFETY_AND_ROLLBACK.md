# GRUK Empresarial — control de liberación y reversión (P0-01 / P1-75)

Estado: **procedimiento propuesto, NO certificado**. Este documento no autoriza un despliegue.

## Riesgo verificado (2026-11-03)

Dos servicios Render están vinculados a `main` con `autoDeploy=yes`:
- `srv-d6n2kd75gffc73bq5oqg` — `resturante-qr-1` — build `npm install`.
- `srv-d6n2j07kijhs73e6jrjg` — `resturante-qr` — build `yarn`.

**Bloqueo:** NO fusionar PR a `main` mientras ambos servicios puedan publicar automáticamente. El segundo servicio usa un gestor de paquetes diferente; no presumir equivalencia de lockfiles. Ninguno debe usarse como staging sin autorización explícita.

## Precondiciones para una fusión

1. Identificar el servicio Empresarial autorizado, sus variables de entorno, base de datos, rama y dominio. Verificar que GRUK Finanzas Personales y Blushéa no comparten esos recursos.
2. Desactivar y **volver a consultar** `autoDeploy=no` en ambos servicios; registrar fecha, operador y evidencia. No basta con una captura antigua.
3. Confirmar que el PR apunta a `main`, no toca rutas o datos personales/Blushéa y tiene revisión de aislamiento por empresa/sede.
4. Exigir checks CI completos en el SHA final del PR: sintaxis, pruebas, Quality Gate, seguridad, persistencia offline, y pruebas pertinentes de idempotencia/ledger/reconciliación. Un job omitido o pendiente no equivale a aprobado.
5. Tener snapshot/restauración verificable de datos, migraciones reversibles o plan de recuperación y commit anterior identificado. Probar recuperación en staging, sin modificar producción.
6. Fusionar únicamente después de cumplir todos los puntos anteriores; la fusión **no** autoriza despliegue.

## Liberación manual — solo al certificar los 77 requisitos

1. Aprobar matriz de trazabilidad de los 77 ítems (requisito → código → prueba → ejecución → evidencia), pruebas end-to-end y revisión de seguridad.
2. Confirmar servicio Render correcto y configuración del build reproducible (`npm ci` y lockfile validado, si aplica); mantener los otros servicios sin cambios.
3. Registrar SHA de release y SHA anterior, respaldo de base de datos, responsable, ventana de despliegue y criterio de reversión.
4. Desplegar manualmente al servicio autorizado y esperar estado `live`. Consultar URL pública y `/health` con respuesta HTTP 200; verificar además un flujo transaccional real de prueba sin efectos sobre clientes.
5. Si hay error: detener tráfico/escrituras según procedimiento de incidente, volver al SHA anterior mediante despliegue controlado, restaurar datos solo si está justificado y comprobar integridad; conservar evidencia del incidente.
6. No declarar producción completa hasta registrar resultados observables y aprobar la liberación.

## Matriz de evidencia de este bloque

| Requisito | Cambio | Prueba/criterio | Estado |
| --- | --- | --- | --- |
| P0-01 separación Empresarial/Personal | Procedimiento de no interferencia y verificación de recursos | Test automatizado de aislamiento de datos y despliegues | **Pendiente** |
| P1-75 gobierno de cambios | Este runbook de bloqueo, aprobación y rollback | CI/CD, staging, pruebas y reversión ejercitada | **Parcial: documento; no probado** |

Este archivo no altera código de negocio, dependencias, servicios Render ni bases de datos.
