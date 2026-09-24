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
