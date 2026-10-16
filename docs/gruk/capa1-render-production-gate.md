# Capa 1 — Gate de producción del servicio oficial

## Alcance autorizado
El único servicio objetivo de GRUK Empresarial es `resturante-qr`
(`srv-d6n2j07kijhs73e6jrjg`; https://resturante-qr.onrender.com).
El servicio adicional `resturante-qr-1` queda fuera de las verificaciones y operaciones.
Su eliminación queda a cargo del propietario. No modificar
`gruk-finanzas-personales` ni su rama.

## Evidencia del servicio oficial
- Render confirma `autoDeploy=yes` desde `main`.
- **Configuración real observada en Render:** runtime `node`, comando de compilación `yarn`, comando de inicio `node app.js`, sin `healthCheckPath` configurado, una instancia y plan `free`. Por tanto, **la imagen Docker construida por CI no es la imagen que Render ejecuta actualmente**. No equiparar `docker build` verde con un despliegue Docker en Render.
- Antes de promover, alinear el gestor de dependencias del servicio con el lockfile elegido y configurar un health check de Render solo cuando `/health` esté disponible en la revisión desplegada.
- En el despliegue del commit `921a1c6` (2 octubre 2026), la compilación
  terminó correctamente pero el proceso de ejecución terminó con código 1;
  Render marcó `update_failed`. La excepción concreta sigue sin identificar.
- Los logs históricos consultados para ese intervalo no estaban disponibles.
  No atribuir la causa a MongoDB, variables de entorno ni puertos sin evidencia.
- El endpoint `/health` de este PR todavía no está desplegado.
- GitHub CI #1778 pasó: `npm run gate`, MongoDB replica set,
  `docker compose config --quiet` y `docker build`.

## Mecanismo de despliegue
- Render despliega automáticamente `main`; el workflow
  `.github/workflows/deploy.yml` **no dispara despliegues**.
- El workflow manual `workflow_dispatch` ejecuta verificaciones y
  consulta únicamente `https://resturante-qr.onrender.com/health` y exige que el campo `commit` coincida exactamente con el SHA verificado.
  Antes de fusionar, esa consulta no puede certificar la versión del PR.
- Un merge a `main` puede desplegar inmediatamente, sin esperar el
  resultado del workflow de GitHub. Por eso la CI verde por sí sola
  **no constituye un gate de despliegue**.
- Para una promoción realmente controlada, primero configurar Render
  para desplegar solamente revisiones aprobadas, verificar staging y
  conservar un procedimiento de rollback. No cambiar ajustes de Render
  sin un plan de recuperación comprobado.

## Controles pendientes — NO GO
1. Diagnosticar el cierre `nonZeroExit=1` del servicio oficial.
2. Revisar el comando `yarn` actualmente usado por Render frente a `npm ci` en CI; comprobar la compatibilidad del lockfile antes de cambiar la configuración.
3. Verificar que la aplicación arranca con su configuración real y que
   `/health` devuelve HTTP 200 y `status=ok`, `db=connected`.
4. Validar staging y rollback antes de la primera promoción.
5. Evitar que cualquier cambio del ledger o cobros se active por accidente.
6. Revisar manualmente el PR, las dependencias y la configuración de seguridad.

## Seguridad de Docker Compose
`docker-compose.yml` es una referencia **solo para desarrollo aislado**:
MongoDB y Redis carecen de autenticación y no deben exponerse en redes
públicas. El `.env.example` contiene secretos ficticios y no es una
configuración válida para producción. El entorno oficial sigue usando
su base de datos y configuración gestionadas por Render.

## Estado
Infraestructura preparada y CI aprobada. **No desplegado ni certificado
en producción**. No afirmar integridad financiera total ni tolerancia a
fallos hasta completar las pruebas transaccionales.
