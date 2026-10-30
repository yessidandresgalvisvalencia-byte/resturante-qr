# P0-70 — Auditoría de lectura QR por mesa (30-10-2026)

**Fuente:** Plan Maestro 77, requisito 70. **Estado: PARCIAL, no certificado.**

## Evidencia inspeccionada en rama de integración #524

- `routes/API.js` GET `/pedidos/mesa/:mesa` (línea ~1509) y GET `/factura/mesa/:mesa` (~2241) llaman `resolveMesaQrRead` y usan `Pedido.find(scope.filter)`; ambas respuestas usan `Cache-Control: no-store` y una proyección de campos.
- `core/security/qrMesaRead.service.js` verifica HMAC-SHA256, firma con comparación temporal segura, expiración, empresa, restaurante, mesa y sede; vuelve a consultar restaurante/sede persistidos antes de permitir lectura.
- **Brecha pendiente:** `resolveMesaQrRead` devuelve filtros de pedidos con `restaurantId`, `mesa` y `sedeId`, **pero sin `empresaId`**. La comprobación previa de `Restaurante` por empresa no demuestra por sí sola que cada `Pedido` leído pertenezca a esa empresa. Se necesita verificar invariantes de unicidad global de `restaurantId`, migración de pedidos históricos, y/o imponer empresa en consulta de forma compatible con datos legados. No marcar aislamiento de base de datos como verificado.
- **Riesgo adicional:** token de capacidad QR en parámetros de URL; comprobar redacción de logs, analítica, referer y política de redirección antes de producción. Caducidad actual: 90 días; falta estrategia operativa de revocación/reimpresión.
- **Evidencia aún ausente:** pruebas HTTP + MongoDB real de colisión de identificadores y sedes, migración de pedidos sin `empresaId`, navegador E2E, reimpresión de QR, Wompi, logs y observabilidad.

## Criterio de cierre de este hallazgo

1. Construir fixtures con dos empresas y restaurantes con identificadores en conflicto, pedidos históricos y sedes con alias.
2. Comprobar que un QR de A jamás lee pedidos de B, incluso cuando comparten mesa/sede o hay registros legados; denegar ambigüedad.
3. Aplicar filtro de empresa en consulta o demostrar por pruebas e índices una invariante equivalente y resistente a concurrencia.
4. Ejecutar pruebas de integración reales y guardar enlaces a checks; no fusionar a `main` mientras Render Auto-Deploy pueda publicar prematuramente.

**Resultado:** auditoría de código, no corrección funcional ni prueba de aceptación. No autoriza despliegue.

## Corrección propuesta (30-10-2026)

- Commit `b07e434`: `resolveMesaQrRead` incluye `empresaId: p.e` en ambos filtros MongoDB (sede canónica/alias y mesa sin sede). Las rutas HTTP existentes usan `Pedido.find(scope.filter)`, por lo que pedidos de otras empresas y registros sin `empresaId` quedan excluidos (fail-closed).
- Commit `2e85b00`: pruebas unitarias del filtro, alias y denegación de restaurante ajeno en `test/gruk/p0-70-qr-read-enterprise-filter.test.js`.
- **No certificado:** faltan ejecución y resultados de CI, prueba HTTP+MongoDB real con colisiones, plan de migración de pedidos legados, QR en navegador, Wompi y auditoría de filtración de tokens. No desplegar.
