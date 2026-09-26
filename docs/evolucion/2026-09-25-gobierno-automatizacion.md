# Propuesta de Evolución GRUK — Gobierno de automatización

## Fuente
Akamai (23-sep-2026) recomienda gobernar comportamiento, conexiones y permisos de agentes empresariales. Security.com (21-sep-2026) destaca controles positivos para ejecución automatizada.

## Estado actual de GRUK
Se revisaron core/auth/auth.middleware.js, core/auth/roleCheck.middleware.js, intelligence/board/expertos.service.js y docs/CONSEJERO-EVOLUCION-GRUK.md. GRUK ya aplica autenticación, empresa y roles a usuarios. La Junta actual es determinística y no ejecuta acciones.

## Brecha
Antes de ampliar la autonomía futura hace falta un contrato central que defina qué acciones automatizadas están permitidas y cuáles requieren aprobación humana. Hoy ese límite existe como principio de diseño, pero no como política técnica reutilizable.

## Decisión
IMPLEMENTAR AHORA.

## Cambio propuesto
Añadir una política central cerrada por defecto antes de conectar cualquier ejecución autónoma. La primera iteración no habilitará nuevas acciones; únicamente formalizará límites y pruebas. Operaciones sensibles continuarán requiriendo aprobación humana.

## Riesgo de producción
BAJO mientras la política permanezca aislada y no habilite ejecución nueva. La integración futura con un ejecutor será evaluada separadamente.

## Pruebas obligatorias
Acción no declarada denegada; contexto incompleto denegado; aislamiento por empresa y sede; operaciones sensibles requieren humano; regresión de autenticación y roles.

## Criterio de éxito
GRUK dispone de un único contrato testeado que niega por defecto cualquier acción automatizada no declarada antes de habilitar niveles superiores de autonomía.

## Otros casos evaluados
EVALUAR: agentes por rol en ERP. Dynamics 365 y SAP refuerzan inteligencia empresarial contextual por función, pero GRUK ya separa Neuronas y Junta; no conviene aumentar autonomía antes del control anterior.

DESCARTAR: volver a IA generativa como requisito de Junta. GRUK-DETERMINISTICO-1 cubre la necesidad actual sin costo externo.

EVALUAR: controles específicos para contenido externo no confiable. Serán prioritarios cuando GRUK ingiera correo, web o documentos externos en flujos capaces de ejecutar acciones; la Junta determinística actual no lo hace.


## Actualización 26-sep-2026 — identidad y trazabilidad de agentes

### Fuente
- Microsoft Security Research, 16-jul-2026: least privilege para agentes mediante identidad, acceso y tool binding.
- Check Point, 24-sep-2026: los agentes empresariales deben tratarse como identidades privilegiadas y gobernarse antes de ampliar autonomía.
- Security Boulevard, sep-2026: la auditoría de agentes debe poder reconstruir iniciador, agente, datos influyentes, herramientas disponibles, cambios y aprobaciones humanas.

### Hallazgo externo
La práctica está convergiendo en tres controles complementarios: identidad propia del actor automático, permisos mínimos ligados a herramientas/acciones y trazabilidad causal de cada ejecución. No basta con reutilizar el JWT del humano ni registrar solamente el resultado final.

### Estado actual de GRUK
`core/auth/auth.middleware.js` modela identidad humana (usuario, empresa, sede, rol). `core/auth/roleCheck.middleware.js` autoriza roles humanos. `intelligence/brain/cerebro.service.js` audita aprobación/rechazo humano de órdenes y Junta, pero no existe todavía una identidad técnica de agente ni un registro de tool/action binding porque GRUK aún no ejecuta autonomía L3/L4.

### Brecha
Antes de conectar Expertos/Cerebro a acciones ejecutables falta un principal no-humano explícito y un sobre de autorización que incluya como mínimo `actorType`, `agentId`, `empresaId`, `sedeId`, `action`, recurso objetivo, política aplicada y aprobación humana cuando corresponda. Sin esto una futura acción autónoma sería difícil de atribuir y limitar con precisión.

### Decisión
IMPLEMENTAR AHORA, como extensión de esta propuesta y todavía sin habilitar ejecución autónoma.

### Cambio propuesto
La futura política deny-by-default debe evaluar identidad del agente + tenant + acción + recurso, y producir una decisión de autorización auditable. Mantener autenticación humana separada de identidad de agente; nunca entregar a un agente un JWT humano general. Registrar intento permitido o denegado sin secretos ni payloads sensibles.

### Riesgo de producción
BAJO si se implementa primero como módulo aislado sin conectarlo a rutas de negocio. MEDIO cuando se integre posteriormente con ejecutores; esa integración requerirá PR separado.

### Pruebas obligatorias
Agente desconocido denegado; acción no allowlisted denegada; cruce de empresa/sede denegado; permiso de lectura no autoriza escritura; acción sensible exige aprobación; auditoría registra actor/política/resultado sin credenciales; regresión de auth humana.

### Criterio de éxito
Antes de cualquier L3/L4, una acción automática no puede llegar a un servicio de dominio sin una decisión explícita de política y queda trazable a una identidad de agente, tenant y aprobación aplicable.

## Casos del 26-sep-2026

### EVALUAR — ERP conversacional conectado a datos vivos
Epicor Prism y Zoho Inventory MCP refuerzan la dirección de consultar ERP/inventario en lenguaje natural sobre datos operativos vivos. GRUK está construyendo Junta/Expertos, pero no debe abrir herramientas de escritura hasta completar el control de identidad/acción anterior. Evaluar después como interfaz de lectura con aislamiento multitenant.

### EVALUAR — automatización financiera agentic
La alianza Rillet/RSM anunciada el 23-sep-2026 apunta a automatización contable con datos conectados y controles en tiempo real. GRUK todavía no tiene un ledger contable completo ni evidencia suficiente para automatizar contabilidad; copiar esa capacidad ahora ampliaría superficie y complejidad antes de tener la base financiera.

### DESCARTAR — aumentar autonomía solo porque el mercado migra a agentic ERP
Noticias recientes sobre SAP, Microsoft y otros proveedores confirman la tendencia, pero no constituyen evidencia de que GRUK deba saltar sus niveles de aprobación. La prioridad sigue siendo contexto confiable, permisos y trazabilidad antes de autonomía.
