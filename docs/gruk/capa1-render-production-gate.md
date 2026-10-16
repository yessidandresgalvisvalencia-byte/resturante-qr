# Capa 1 — Gate de despliegue Render (15 octubre 2026)

## Evidencia verificada
- Render `resturante-qr-1` (`srv-d6n2kd75gffc73bq5oqg`): despliegue del commit `921a1c6` marcado `live`.
- Render `resturante-qr` (`srv-d6n2j07kijhs73e6jrjg`): mismo commit con `update_failed`.
- Eventos Render del segundo servicio: `build_ended=succeeded`, seguido de `deploy_ended=failed` y `nonZeroExit=1`. La causa concreta no se conoce.
- Logs de arranque del primer servicio confirman conexión MongoDB y escucha en puerto 10000. No hay evidencia suficiente para certificar el segundo.
- Ambos servicios siguen `main` con `autoDeploy=yes`. Una fusión afecta ambos.
- `/health` y `/ready` existen solo en esta rama hasta fusionar. No afirmar que funcionan en producción.

## Bloqueos de promoción (NO GO)
1. Identificar y corregir el cierre con código 1 de `resturante-qr`; no atribuir causa a secretos sin evidencia.
2. Confirmar rol y necesidad de ambos servicios empresariales; acordar estrategia de despliegue para ambos.
3. Verificar secrets `DEPLOY_HOOK_URL` y `PRODUCTION_HEALTH_URL` en el entorno de GitHub Actions, sin exponer valores.
4. Evitar dos disparadores de despliegue concurrentes: Render autoDeploy por commit y hook desde GitHub Actions. Desactivar uno solo tras verificar que el otro cubre ambos servicios.
5. Probar staging y verificar HTTP 200 con JSON `status=ok`, `db=connected`, `version` y `uptime`.
6. Probar rollback de la revisión previa, sin tocar bases de datos reales.
7. Aprobar PR después de pasar CI; ninguna aprobación de agente sustituye revisión humana.

## Restricciones
- No alterar `feature/finanzas-personales` ni el servicio `gruk-finanzas-personales`.
- No activar el ledger nuevo, operaciones financieras, outbox ni automatismos de cobro.
- La CI verde prueba solo el alcance que ejecuta; no certifica seguridad total ni disponibilidad de Render.
