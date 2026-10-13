# GRUK — Integración ejecutable del Plan Maestro Unificado

**Documento fuente:** `GRUK_Documentos_Unificados_Plan_Maestro.docx`, 9 de octubre de 2026 (13 páginas).  
**Integración:** 13 de octubre de 2026.  
**Estado:** propuesta de ejecución y auditoría; **no certifica despliegue ni funcionalidades listas**.

## Reglas de interpretación

- Los identificadores **01–77** pertenecen al plan maestro; **P0.01–P9.10** al anexo. Son sistemas distintos y se preservan.
- Los títulos P0/P1/P2/P3 del primer plan significan urgencia; los prefijos P1.01, P2.01 etc. del anexo identifican *fase*. No confundir prioridad con fase.
- Los checkboxes del documento original están pendientes y solo se marcan como hechos tras prueba documentada.
- Este repositorio es GRUK **empresarial/restaurantes**. Finanzas personales debe quedar aislado (01, P0.02); ningún cambio de esta integración modifica finanzas personales.
- Mantener GRUK como plataforma multinegocio a largo plazo, empezando por un flujo restaurante medido (03, 11, P7.01–P7.09).
- Aplicar `routes → controller → service → model → eventBus` sin atribuir a un EventBus en memoria garantías de entrega durable.
- Ningún modelo/neurona tiene permisos para aprobar pagos, alterar datos de otras empresas o actuar sin la autorización requerida.

## Convergencia de la visión con lo que hay en el repositorio

Documentos existentes: `docs/vision-arquitectura-gruk.md` y `docs/roadmap-restaurantes.md`.
Ambos favorecen la cadena económica **PEDIDO → VENTA → PRODUCTO → RECETA → INSUMO → INVENTARIO → COSTO → MARGEN**.

Inspección puntual de `main` realizada durante esta integración:

| Superficie | Evidencia inspeccionada | Estado verificable | Acción |
|---|---|---|---|
| Runtime | `package.json` (Node 20, Express 5, Mongoose 9, `npm run gate`) | Scripts declarados; ejecución CI y despliegue no comprobados | Ejecutar gate en rama y entorno limpio |
| Empresa/tenant | `models/restaurante.js`, `models/sede.js`, `models/usuario.js` | `empresaId` presente en los tres; algunos campos permiten `null` | Auditar filtros, asignación y migración multiempresa |
| Identidad | `models/usuario.js` | Roles `admin_general`, `admin_sede`, `mesero` | Contrastar con matriz de dueño/gerente/cajero/inventario/cocina/contador |
| Ventas | `services/ventas.service.js` | Valida producto por `empresaId`, crea venta con sesión opcional, captura excepciones de índice único | Probar idempotencia, transacciones y referencias entre tenants |
| Eventos | `services/ventas.service.js` | Con `emitirEvento=true`, llama `eventBus.emit('VENTA_COMPLETADA')` durante la ejecución, incluso si recibe `session` | **Bloqueante:** probar flujo post-commit; usar outbox transaccional para entrega durable |
| Costos | `services/ventas.service.js` | Lee `costoUnitario` de `ProductoServicio` y marca `NO_CONFIGURADO` cuando es cero | No declarar margen confiable sin receta, unidades, insumos y costeo demostrable |
| Suscripciones | `models/restaurante.js` | Campos para estado y referencia Wompi | Requiere reconciliación end-to-end antes de certificar cobros |

**No auditado todavía:** controles de acceso en todas las rutas, integridad de índices Mongo, configuración Atlas de replica set, webhook Wompi, APIs de pedidos, jobs, Render, Socket.io, backups y monitoreo. El documento fuente tampoco confirma esos estados.

## Entrega A — Producto estable: secuencia obligatoria

| Orden | IDs fuente | Cambio verificable | Criterio para avanzar |
|---|---|---|---|
| A1 | 01, 02, 04, 69, 70; P0.01, P0.02, P0.07 | Inventario de endpoints/modelos/infraestructura, aislamiento personal/empresarial, matriz tenant y roles | Pruebas negativas de filtración y evidencia de entornos separados |
| A2 | 05, 08, 09; P1.01–P1.03, P1.07 | Máquina de estados única de pedido/pago, políticas por rol, auditoría con actor y correlación | Transiciones inválidas denegadas y trazables |
| A3 | 06, 07; P1.04–P1.06 | Idempotencia en venta/pago/webhook, sesión ACID para registros relacionados, outbox de eventos en la misma transacción | Reintentos concurrentes no duplican ventas ni cobran dos veces; rollback no produce eventos externos |
| A4 | 03, 10; P2.01–P2.09, P3.04–P3.09 | Flujo pedido → venta → receta → consumo → caja → costo/margen con procedencia | Prueba end-to-end realista; valores reconciliados |
| A5 | 11, 12, 21; P7.01–P7.09 | Piloto medido, excepciones validadas, ROI por flujo | Línea base y cambios medidos con evidencia |

### Requisitos concretos para A3

1. Crear una clave única de evento de pago de proveedor y un índice único efectivo por operación/tenant cuando corresponda. Revisar esquema y migración antes de aplicar índices.
2. Validar firma/autenticidad del webhook; nunca fiarse del estado de pago enviado desde el frontend.
3. La unidad atómica de venta debe persistir: pago verificado, estado de pedido, venta, consumo de inventario cuando corresponda, asiento/movimiento económico y mensaje de outbox.
4. Solo un despachador posterior al commit entrega eventos del outbox, con reintentos y consumidor idempotente; impedir emisión visible antes del commit.
5. En error transitorio de transacción, reintentar de manera acotada con misma clave idempotente; en fallo definitivo devolver estado seguro sin afirmar éxito.
6. Conservar correlación `empresaId`, `sedeId`, `pedidoId`, `paymentProviderId`, `correlationId`, `actor`, `timestamp`.
7. Probar caída antes del commit, caída después del commit pero antes del despacho, entrega duplicada, notificación fuera de orden y doble solicitud simultánea.

## Entrega B — Un asistente de valor, sin escrituras

IDs **13–15**, **16–19** cuando A esté validado, y **P8.01–P8.04**. Exponer herramientas tipadas solo lectura para ventas, inventario y costos. Cada diagnóstico lleva evidencia, sello temporal, datos faltantes, incertidumbre y límites de rol. Benchmark de 20 casos antes de lanzamiento (14).

## Entrega C — Acción supervisada

IDs **20, 35–38** y **P6.01–P6.08**. Action Layer con operaciones tipadas, permisos en servidor, aprobación humana explícita, bitácora y verificación posterior. Las órdenes del Cerebro nunca sustituyen comprobación del efecto real.

## Entrega D — Contexto, memoria y medición

IDs **22–34, 51–58**, **P4.01–P5.09**. Primero historical log y evidencia; después índice, grafo operacional y memoria con caducidad. Experimentos y replay fuera de producción; no atribuir causalidad ni ahorro sin medición.

## Entrega E/F — Coordinación y optimización condicionadas

IDs **39–50, 59–68**, y anexo **P9.01–P9.10**. Activar agentes especializados y expansión solo si métricas de exactitud, seguridad, costo y ROI superan al sistema simple. Los requisitos **71–77** son transversales a cada entrega.

## Gate de promoción (cualquier PR a producción)

- [ ] `npm run gate` en entorno reproducible.
- [ ] Tests de multi-tenancy por entidad, ruta, caché y evento.
- [ ] Tests de idempotencia concurrente, rollback y post-commit.
- [ ] Reconciliación de pagos y caja con fuentes originales.
- [ ] Métricas y alarmas de errores, latencia y discrepancias.
- [ ] Plan de migración reversible, backups/restauración y rollback del despliegue.
- [ ] Revisión humana de cambios que afecten dinero, identidades y permisos.
- [ ] Evidencia de ejecución en staging y monitoreo tras despliegue.

**Estado de esta integración:** planificación incorporada al control de versiones en una rama separada; no se modifican rutas, base de datos ni pagos en producción. Para iniciar A3 se requiere inspección de los flujos de pedidos/webhooks y pruebas de integración con MongoDB.
