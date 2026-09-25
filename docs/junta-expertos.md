# Junta Directiva GRUK — motor experto nativo

## Objetivo

La Junta Directiva es consultiva. Finanzas, Ventas, Marketing, Operaciones, Gente y Dirección deliberan sobre una pregunta humana usando exclusivamente lógica propia de GRUK, reportes de neuronas y contexto conversacional persistido.

La Junta no genera órdenes ejecutables; esa autoridad sigue reservada al Cerebro GRUK.

## Dependencias externas

Ninguna.

La Junta no requiere OpenAI, API keys, modelos remotos ni proveedores de IA externos. El motor de Junta no realiza llamadas de red para generar respuestas.

No existen variables `OPENAI_API_KEY`, `GRUK_EXPERT_MODEL` ni equivalentes para esta función.

## Cómo funciona

1. Clasifica la intención de la pregunta.
2. Detecta los temas empresariales implicados: caja, margen/precio, ventas, CAC, operación/inventario, gente/capacidad, crecimiento, deuda o servicio.
3. Cada experto aplica su perfil, principios y playbooks propios.
4. Cruza la pregunta con el reporte determinístico de su neurona.
5. Separa evidencia real, criterio profesional, inferencias y datos faltantes.
6. Genera riesgos, acuerdos y objeciones cruzadas entre funciones.
7. Dirección sintetiza la discusión sin emitir órdenes.
8. El Cerebro conserva autoridad exclusiva para decidir y mandar órdenes.

## Seguridad

Todo se ejecuta dentro de GRUK. No se envían datos de empresa, usuarios, decisiones, KPIs ni conversaciones a terceros.

No se guarda cadena privada de razonamiento. Se persisten únicamente resultados auditables: respuesta, criterio profesional, evidencia usada, inferencias, riesgos, objeciones, acuerdos, datos faltantes y confianza.

Los endpoints existentes de `/api/junta` mantienen `auth + empresaId + roleCheck`. DUEÑO y ADMIN_SEDE conservan acceso; EMPLEADO no obtiene acceso a la Junta.

## Compatibilidad

Las sesiones nuevas se guardan como `EXPERTO_GRUK`.

El modelo acepta también el tipo histórico `EXPERTO_IA` exclusivamente para poder leer sesiones ya persistidas antes de esta migración.

No se modifica `app.js`, el flujo del Cerebro ni la aprobación humana de órdenes.
