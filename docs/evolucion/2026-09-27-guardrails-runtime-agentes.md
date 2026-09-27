# Evolución GRUK — Guardrails de runtime para Expertos y futuros agentes

## Fuente
- 2026-09-27: vulnerabilidades y gobierno de agentes empresariales.
- 2026-09-24: ERP evoluciona hacia sistemas de acción con agentes.
- 2026-09: patrón de agentes con herramientas reutilizables y contexto empresarial vivo.

## Hallazgo externo
Los agentes aumentan capacidad y superficie de ataque. El control no puede depender solo del prompt: la ejecución debe negar por defecto herramientas y acciones no autorizadas y separar identidad, permisos, datos y aprobación.

## Estado actual de GRUK
- core/auth/auth.middleware.js autentica humanos por JWT y fija usuario/empresa/sede/rol.
- core/auth/roleCheck.middleware.js autoriza por rol.
- intelligence/board/expertos.service.js mantiene la Junta consultiva.
- docs/CONSEJERO-EVOLUCION-GRUK.md exige evidencia, rama, pruebas y no despliegue automático.

## Brecha
No existe un Policy Enforcement Point independiente para futuros agentes/herramientas que evalúe principal técnico + empresa + sede + acción + recurso + aprobación. roleCheck protege usuarios HTTP, pero no basta para L3/L4 ni herramientas invocadas por modelos.

## Decisión
IMPLEMENTAR AHORA, empezando por infraestructura inerte sin habilitar autonomía.

## Cambio propuesto
Crear core/automation/actionPolicy.service.js con deny-by-default y catálogo explícito. Separar principal HUMANO de AGENTE. Registrar autorización y correlationId. Ningún experto de Junta obtiene escritura por defecto. Herramientas futuras serán tenant-scoped y validadas. Finanzas, pagos, credenciales, usuarios, borrados y políticas requieren aprobación humana hasta política posterior explícita.

## Archivos afectados
- core/automation/actionPolicy.service.js (nuevo)
- core/automation/agentPrincipal.js (nuevo)
- intelligence/board/* solo al integrar herramientas
- auditoría al ejecutar
- test/gruk/*

## Riesgo de producción
BAJO mientras el módulo no se conecte a rutas existentes; MEDIO al conectarlo a ejecutores. Sin migración destructiva.

## Pruebas obligatorias
1. acción desconocida => DENY.
2. agente fuera de empresa/sede => DENY.
3. aislamiento multitenant.
4. agente consultivo no obtiene escritura.
5. acción sensible sin aprobación => DENY.
6. allowlist exacta.
7. prompt/evidencia no amplía permisos.
8. regresión auth/roleCheck.

## Criterio de éxito
Ninguna ejecución automática actúa fuera de una acción explícitamente permitida; toda acción desconocida o fuera del tenant se rechaza antes de tocar datos. Junta consultiva y Cerebro como autoridad de decisión.

## Clasificaciones relacionadas
- EVALUAR: herramientas de lectura para Expertos sobre datos ERP vivos después del Policy Enforcement Point.
- EVALUAR: memoria compartida gobernada; requiere procedencia y distinción hecho/corrección/criterio.
- DESCARTAR: autonomía end-to-end o pagos automáticos antes de identidad técnica, policy enforcement, auditoría causal y pruebas multitenant.
