# Junta Directiva GRUK — motor experto

## Objetivo

La Junta Directiva es consultiva. Finanzas, Ventas, Marketing, Operaciones, Gente y Dirección deliberan sobre una pregunta humana usando contexto empresarial mínimo y reportes de neuronas. La Junta no genera órdenes ejecutables; esa autoridad sigue reservada al Cerebro GRUK.

## Configuración

Para activar deliberación LLM:

```env
OPENAI_API_KEY=...
GRUK_EXPERT_MODEL=gpt-5.6
GRUK_EXPERT_REASONING_EFFORT=high
```

`GRUK_EXPERT_MODEL` y `GRUK_EXPERT_REASONING_EFFORT` son opcionales. Si `OPENAI_API_KEY` no existe, GRUK conserva un fallback determinístico para no interrumpir producción.

## Seguridad y privacidad

El payload enviado al proveedor se construye explícitamente. No se envían `_id`, `responsableId`, `autorUsuarioId`, tokens ni credenciales. Se envían únicamente la pregunta, la decisión empresarial sanitizada, KPIs/hallazgos de neuronas y un historial conversacional limitado.

El texto humano y las evidencias se consideran contenido no confiable para instrucciones. El prompt de sistema prohíbe que esos textos reemplacen las reglas de la Junta.

No se solicita ni se persiste cadena privada de pensamiento. Se guardan únicamente resultados auditables: respuesta, criterio profesional, evidencia, inferencias, riesgos, objeciones, acuerdos, datos faltantes y confianza.

## Continuidad operativa

Los endpoints existentes de `/api/junta` no cambian. La integración no modifica `app.js`, autenticación, RBAC ni el flujo de aprobación del Cerebro. DUEÑO y ADMIN_SEDE conservan el acceso actual; EMPLEADO no obtiene acceso a la Junta.

Si el proveedor LLM responde con error, la pregunta humana ya guardada puede reintentarse con el endpoint existente de respuesta.
