# GRUK Capa 1 — integración controlada (17 octubre 2026)

## Alcance confirmado
Este commit contiene un contrato y pruebas iniciales para eventos offline multinegocio. No está conectado a rutas, bases de datos, ventas, caja ni pagos existentes. No está desplegado y no habilita ventas sin internet.

## Aceptación antes de activar offline
- Empresa, sede y actor se derivan de sesión autenticada del servidor; jamás del payload cliente.
- Guardar cada evento en una colección inbox con índice único {empresaId,sedeId,eventId} y transacción Mongo; deduplicar reintentos incluso entre procesos y reinicios.
- Validar permisos por rol y recurso; rechazar eventos entre empresas/sedes; limitar tamaño de payload.
- Conciliar stock y precios usando versiones e identificar conflictos. No confirmar pagos con tarjeta sin confirmación de la pasarela.
- Implementar outbox local duradero con IndexedDB o base local y estado pendiente/confirmado/error; pruebas de reconexión y apagado.
- Una red local o nodo de sede es requisito adicional para comandas entre dispositivos sin internet.
- Auditar dinero y ObjectId legados antes de migrar. No reemplazar modelos de producción en caliente.
- Despliegue únicamente tras npm ci, npm test, Docker build, backup, rollback y /health 200 verificado.

## Ejecución
node --test test/gruk/capa1-offline.contract.test.js

En este punto se preserva `main` intacta y no se activa deploy automático.
