# GRUK Empresarial — trazabilidad P0-04 (evidencia parcial)

Fuente normativa: `GRUK_Documentos_Unificados_Plan_Maestro.docx`, implementación **04 [P0]**: normalizar Empresa, Sede, Usuario, producto, pedido, venta, pago, stock y proveedor con IDs estables. **Aceptación oficial:** no hay filtraciones entre empresas ni sedes.

> Esta matriz registra solo evidencia localizada del subalcance Venta. No certifica P0-04 ni sustituye la matriz global de 77 requisitos. Estado: **PARCIAL / BLOQUEADO PARA MERGE Y PRODUCCIÓN**.

| Criterio verificable | Implementación | Prueba o evidencia | Estado y limitación |
| --- | --- | --- | --- |
| Unicidad de origen por empresa para Venta | `models/Venta.js` | `test/gruk/p0-04-venta-origin-tenant-index.test.js` | Prueba de esquema; no valida índice instalado en MongoDB |
| Detectar ventas sin empresa válida y referencias huérfanas | `scripts/gruk/p0-04-venta-index-preflight.js` | `test/gruk/p0-04-venta-index-preflight.test.js` | Pruebas con dobles de MongoDB; pendiente base aislada |
| Detectar sede inválida o ajena a la empresa | Mismo preflight, consulta `sedes` | Mismo test: casos de `invalidSiteIds` e `invalidSiteOwnership` | No demuestra aislamiento en endpoints de escritura/lectura |
| Detectar duplicados, índices heredados e incompatibles | Mismo preflight | Mismo test: duplicados, filtros parciales e índices globales | No se ha ejecutado migración real |
| Migración escalonada y reversión documentadas | `docs/gruk/p0-04-venta-origin-index-migration.md` | Lista DBA y rollback manual | Pendientes respaldo, ensayo de restauración, aprobación y evidencia |
| Aislamiento en todos los modelos y rutas del requisito 04 | Sin evidencia completa en este PR | Faltan pruebas negativas de integración multiempresa/multisede | **NO CERTIFICADO** |
| No alterar GRUK Personal ni Blushea | Preflight bloquea nombres explícitos de esas bases | Test de nombres prohibidos | Defensa parcial; no prueba aislamiento de despliegues |
| CI del commit `fe1a8bf3e40a809d11220776c187899b4082f5d5` | GitHub Actions | [CI](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43667222270), [quality gate](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43667222369), [offline](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43667222362) | Tres ejecuciones success observadas; **no aplican automáticamente a commits posteriores** |

## Puertas de salida pendientes

1. Validar con MongoDB empresarial aislado y datos controlados: dos empresas, dos sedes, origen compartido entre empresas, duplicado dentro de empresa, sede ajena, empresa huérfana y reintentos concurrentes.
2. Capturar resultados, configuración de índices, identificador de base (sin secretos) y hashes de commits como evidencia reproducible.
3. Revisar accesos tenant/sede en modelos y endpoints restantes; comprobar casos negativos, no solo estructura de IDs.
4. Conseguir revisión independiente, CI verde del HEAD final y autorización DBA para cualquier migración.
5. No fusionar, modificar índices productivos ni desplegar Render hasta satisfacer las puertas aplicables y la aceptación global.

La aprobación de CI del preflight no equivale a la certificación del requisito 04 ni de las 77 implementaciones.

## Verificación CI observada (15-11-2026)

El commit `b7a17790883bdba2b0a5527d15b7ae6e76940f04` obtuvo **success** en [GRUK CI #43712429311](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43712429311), [quality gate #43712429333](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43712429333) y [Offline Browser Persistence #43712429315](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43712429315). Esto no certifica integración MongoDB real ni revisión independiente. Las verificaciones deberán repetirse para el HEAD posterior a esta actualización documental.

## Evidencia de integración pendiente — corte 15-11-2026

El commit `8267ac39a7fe9a832a3b10cf83c93b3726e6f359` completó satisfactoriamente [GRUK CI #43790969405](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43790969405), [quality gate #43790969457](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43790969457) y [Offline Browser Persistence #43790969429](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43790969429). Es evidencia **del commit indicado**, no de posteriores.

| Subcriterio P0-04 | Código | Prueba | Evidencia / estado |
| --- | --- | --- | --- |
| Índice único por empresa y origen, filtro parcial ObjectId | `models/Venta.js` | `test/gruk/p0-04-venta-origin-tenant-index.test.js` | CI verde del commit anterior; índice real aún sin verificar |
| Semántica de índice productivo en base aislada (incluye concurrencia, duplicados y tipos heredados) | `models/Venta.js` | `test/gruk/p0-04-venta-mongo.integration.test.js` | Test incorporado; **no consta ejecución real contra MongoDB**; CI general no la acredita |
| Preflight sin escritura y con validación previa de configuración | `scripts/gruk/p0-04-venta-index-preflight.js` | `test/gruk/p0-04-venta-index-preflight.test.js` | CI verde del commit anterior; preflight sobre base real pendiente |
| Aislamiento transversal Empresa/Sede/Usuario/producto/pedido/venta/pago/stock/proveedor | Varios modelos y endpoints, aún por auditar | Pruebas negativas multiempresa y multisede pendientes | **No certificado** |

**Bloqueo verificable:** falta una instancia MongoDB de pruebas inequívocamente aislada, su ejecución documentada con URI redactada, revisión independiente y evidencia E2E. No utilizar base productiva para subsanar esta ausencia. Este cambio documental tampoco queda aprobado hasta que su propio HEAD supere CI.
