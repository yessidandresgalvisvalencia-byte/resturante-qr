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
