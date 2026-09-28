# Consejero de Evolución GRUK

## Propósito

Convertir avances externos útiles en mejoras verificables de GRUK sin perseguir modas ni tocar producción directamente.

El Consejero no administra empresas cliente. Es un proceso interno de ingeniería del producto y por eso vive en GitHub, no en el panel multitenant.

## Ciclo obligatorio

1. Detectar una noticia, estándar, vulnerabilidad, técnica o cambio de producto relevante.
2. Registrar fuente y fecha.
3. Explicar qué afirma realmente la fuente, sin extrapolar.
4. Identificar la función o componente GRUK afectado:
   - CORE
   - Neuronas
   - Cerebro
   - Junta Directiva
   - Memoria
   - Automatización
   - Seguridad
   - UX administrativa
5. Revisar el código actual antes de recomendar cambios.
6. Documentar la brecha concreta entre la práctica externa y GRUK.
7. Clasificar:
   - IMPLEMENTAR AHORA
   - EVALUAR
   - DESCARTAR
8. Para IMPLEMENTAR AHORA, definir:
   - archivos afectados
   - compatibilidad con producción
   - riesgo
   - pruebas requeridas
   - criterio de éxito
9. Trabajar únicamente en rama.
10. Exigir CI verde y revisión del diff antes de mergear.
11. Nunca hacer merge a main ni desplegar por una noticia sin validación del cambio.

## Reglas de evidencia

- Una noticia no es una orden.
- No se inventan métricas, ahorros ni impactos.
- Una recomendación debe citar la fuente externa y señalar evidencia concreta del código GRUK.
- Si GRUK ya resuelve correctamente el problema, se clasifica DESCARTAR.
- Si falta información para validar la utilidad, se clasifica EVALUAR.
- Si una mejora rompe contratos existentes o requiere migración destructiva, no se implementa automáticamente.

## Formato de recomendación

### Título

Resumen técnico breve.

### Fuente

- URL:
- Fecha:
- Tipo: noticia | documentación | vulnerabilidad | estándar | release

### Hallazgo externo

Qué cambió o qué práctica se recomienda.

### Estado actual de GRUK

Archivos y comportamiento actual que se revisaron.

### Brecha

Qué capacidad falta o qué riesgo existe.

### Decisión

IMPLEMENTAR AHORA | EVALUAR | DESCARTAR

### Cambio propuesto

Diseño técnico concreto.

### Riesgo de producción

BAJO | MEDIO | ALTO, con explicación.

### Pruebas obligatorias

Tests unitarios, integración, aislamiento multitenant, seguridad y regresión que correspondan.

### Criterio de éxito

Resultado verificable después del cambio.

## Principio final

GRUK evoluciona por evidencia. Las noticias disparan evaluación; el código, los tests y los resultados deciden si una mejora merece entrar al producto.


---

## Propuesta 2026-09-28 — Trazabilidad de runtime para Expertos y agentes

### Fuente

- URL: https://www.tcs.com/what-we-do/industries/banking/white-paper/zero-trust-autonomous-agents-new-paradigm-ai-age
- Fecha: 2026-09-27
- Tipo: arquitectura / seguridad
- URL: https://www.snowflake.com/en/blog/engineering/enterprise-mcp-gateway-ai-agent-governance/
- Fecha: 2026-08
- Tipo: ingeniería / gobernanza
- URL: https://pressreleases.responsesource.com/news/107627/gooddata-ai-launches-ai-observability-to-track-trace-and-trust/
- Fecha: 2026-09-23
- Tipo: release / observabilidad

### Hallazgo externo

La gobernanza de agentes está pasando de verificar únicamente identidad a verificar cada decisión y herramienta en runtime, con trazabilidad suficiente para reconstruir contexto, autorización, herramienta, resultado y costo. El patrón de gateway/control-plane central evita que cada agente implemente permisos y auditoría por su cuenta.

### Estado actual de GRUK

Se revisaron core/auth/auth.middleware.js, intelligence/board/expertos.service.js, intelligence/board/junta.service.js e intelligence/models/CerebroAuditoria.js. El JWT humano fija usuario, empresa, sede y rol. La Junta conserva evidencia y confianza en intervenciones. CerebroAuditoria registra aprobación/rechazo/superación de órdenes. No existe todavía una traza común para una futura invocación de modelo/herramienta/agente que enlace actor, tenant, propósito, autorización, recurso, resultado, latencia/costo y aprobación humana.

### Brecha

Cuando los Expertos GRUK evolucionen de consejo a herramientas de lectura y posteriormente a acciones aprobadas, los logs dispersos no bastarán para demostrar por qué una acción estuvo permitida ni reconstruir el recorrido completo. Falta un identificador de ejecución y un registro append-only tenant-scoped que sea independiente del proveedor de IA.

### Decisión

IMPLEMENTAR AHORA.

### Cambio propuesto

Crear primero una capa de observabilidad pasiva, sin habilitar nuevas acciones:
- core/automation/AgentRun.js: ejecución con empresaId, sedeId, principal, propósito, estado y timestamps.
- core/automation/agentAudit.service.js: API interna append-only para eventos CONTEXTO_LEIDO, MODELO_INVOCADO, HERRAMIENTA_SOLICITADA, HERRAMIENTA_DENEGADA, HERRAMIENTA_EJECUTADA y APROBACION_HUMANA.
- correlationId/runId propagado por Junta y, posteriormente, Cerebro.
- metadata en allowlist; jamás prompts completos, secretos, tokens o credenciales.
- provider/model, latencia y unidades de uso solo cuando el proveedor las entregue; no estimar costo si no existe tarifa/dato verificable.
- retención y borrado lógico compatibles con empresaId/sedeId.

No conectar todavía herramientas de escritura ni autonomía L3/L4.

### Riesgo de producción

BAJO si los nuevos modelos/servicios permanecen pasivos y ninguna ruta existente depende de ellos. MEDIO al instrumentar la Junta, por lo que esa integración debe ser un PR separado y reversible.

### Pruebas obligatorias

- tenant A no puede consultar trazas de tenant B.
- ADMIN_SEDE queda limitado a su sede.
- eventos desconocidos son rechazados.
- metadata elimina campos no permitidos y no persiste Authorization, JWT, API keys ni secretos.
- una falla de auditoría no concede permisos ni convierte una acción denegada en permitida.
- runId enlaza inicio, decisión de política, herramienta y resultado sin modificar los contratos actuales de Junta/Cerebro.
- regresión completa npm test.

### Criterio de éxito

Una ejecución de prueba puede reconstruirse por runId mostrando quién/qué inició la operación, empresa/sede, propósito, política aplicada, herramienta solicitada, resultado y aprobación cuando corresponda, sin almacenar secretos ni habilitar ninguna capacidad nueva de ejecución.
