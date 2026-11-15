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
