# GRUK Empresarial — Runbook de índice idempotente de ventas

**Estado:** diseño, NO autorizado para producción. **PR:** #88.

## Invariantes

- Nunca eliminar el índice único existente sin una alternativa validada.
- Nunca utilizar `syncIndexes()` como mecanismo automático de migración.
- Nunca cambiar el modelo de ventas ni los índices durante un despliegue sin respaldo recuperable.
- Toda venta se atribuye a una empresa y a un origen; una colisión de idempotencia jamás puede devolver una venta de otra empresa.
- Las escrituras concurrentes deben quedar protegidas por un índice único confirmado en MongoDB, no solamente por verificaciones en Node.

## Fase A: inventario y preflight (solo lectura)

1. Identificar el cluster, base, colección y versión exacta de la aplicación; confirmar que no se trata de la base equivocada.
2. Realizar backup consistente y prueba de restauración en un entorno aislado.
3. Ejecutar `node scripts/audit-venta-idempotency.js` con credenciales **de solo lectura**, desde un entorno autorizado. No almacenar la URI ni el resultado sensible en Git.
4. Comprobar índice existente `{ origen: 1, origenId: 1 }` y cualquier índice equivalente.
5. Comprobar que no existan ventas con `empresaId` ausente o nulo, ni duplicados bajo `{ empresaId, origen, origenId }`.
6. Comprobar si `origenId` se genera de forma global o por empresa; verificar datos históricos y todos los call sites.
7. Si alguna verificación falla, detener la migración.

## Fase B: ensayo aislado

1. Restaurar copia en staging sin conexiones a pasarelas reales.
2. Crear índice único candidato **en staging**:
   `{ empresaId: 1, origen: 1, origenId: 1 }` con filtro parcial `{ origenId: { $type: "objectId" } }`.
3. Probar dos empresas con igual `origenId`, repetición del mismo pedido en una empresa y reintentos concurrentes.
4. Validar que una colisión de clave duplicada no sea interpretada como éxito si la venta encontrada pertenece a otro tenant.
5. Validar rollback, eventos post-commit, totales monetarios y reconciliación con la pasarela.
6. Registrar evidencia reproducible de pruebas y tiempos de construcción del índice.

## Fase C: despliegue con ventana controlada

1. Aprobar plan por responsables de plataforma, base de datos y finanzas.
2. Aplicar política temporal que impida escrituras incompatibles durante el cambio de índices.
3. Crear primero el índice candidato, confirmar estado listo y verificar consultas.
4. Retirar el índice global **solo cuando** los escritores desplegados, las pruebas y el plan de reversión lo permitan.
5. Mantener observabilidad de errores E11000, conteos de ventas, pagos y eventos de outbox.
6. Ante anomalías, detener nuevos cambios y ejecutar el procedimiento de recuperación aprobado. No recrear ciegamente el índice global si ya existen claves iguales entre empresas.

## Evidencia requerida para cerrar

- Backup restaurado y conciliado.
- Resultado de preflight revisado.
- Pruebas multiempresa y concurrencia ejecutadas con réplica.
- Plan de rollback ensayado.
- Aprobación de cambio y observabilidad posterior.

**Prohibido:** fusionar este PR interpretando este runbook como autorización de migración.
