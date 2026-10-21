# Evolución GRUK — 2026-10-21 — vencimientos nulos

## Fuente
- URL: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/null
- Fecha: revisada 2026-10-21
- Tipo: documentación

## Hallazgo externo
JavaScript trata null como valor falsy; Number(null || 0) produce 0.

## Estado actual de GRUK
- Archivos revisados: public/js/inventario.js, routes/inventario.js, models/Inventario.js.
- El backend devuelve diasRestantes:null si no existe vencimiento; el frontend lo convierte a 0.

## Brecha
El planificador y el diagnóstico generan alertas y capital en riesgo falsos para productos sin vencimiento. También recomiendan aumentos de compra del 10 al 25% sin evidencia histórica.

## Clasificación
IMPLEMENTAR AHORA.

## Cambio propuesto
Preservar null, filtrar umbrales solo con días finitos, presentar "Sin vencimiento" y eliminar recomendaciones cuantitativas no sustentadas.

## Riesgo de producción
BAJO: cambia asesoría y presentación, no persistencia.

## Pruebas obligatorias
Unitarias, regresión de nulos, vencidos, agotados y fechas 0/5/7/10/20; comprobar capital en riesgo, node --check y npm run gate.

## Criterio de éxito
Sin falsos vencimientos ni porcentajes de compra arbitrarios.

## Regla de despliegue
No mergear a main hasta CI verde y revisión final. No desplegar automáticamente.
