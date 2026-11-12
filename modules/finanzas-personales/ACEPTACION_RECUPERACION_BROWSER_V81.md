# Aceptación de recuperación en navegador — r65

Fecha de revisión: 2026-11-11. Padre real c8b9298096be22dc32eb4deaa3543d30d7c12381; árbol 0ec8529b3f77796896371c6394b98422007bebce. PR #389 abierto sobre feature/finanzas-personales (base 652126a03f19fbec3c529cad1e84bff11cd3699e), integración personal. CI padre: Gate 42247035819, Seguridad 42247035841, V81 42247039110 verdes. #407 abierto.

## Bloque y criterios

Añadir comprobación automatizada del HTML, scripts y CSS reales en Chromium, usando solamente origen interceptado localhost y datos sintéticos. La suite DOM y Mongo existente se conserva. Nuevo job personal en CI con Playwright 1.62.1 aislado en RUNNER_TEMP; no cambia package.json/lock, no depende de credenciales ni datos de producción y no habilita despliegue. No se omite la prueba cuando falta navegador: CI debe instalarlo o fallar.

| Contrato | Comprobación prevista |
| --- | --- |
| Bootstrap y selección | HTML completo, token sintético, pestaña Deudas, historial, botón de revisión y débito/capital/pago real visibles |
| Confirmación y duplicados | Confirmación real de navegador, doble clic produce un POST, cuerpo/clave guardados antes de resolver |
| Respuesta perdida | POST sin respuesta, recarga mantiene PENDIENTE; GET vinculado confirma sin segundo POST |
| Cierre | ANULACION_SUPERADA y CALENDARIO_NO_VIGENTE con GET previo, confirmación explícita, mismo cuerpo/clave y cabecera de cierre |
| Fallos e aislamiento | ok genérico y recibo ajeno no confirman; cambio de propietario tras recarga no muestra diario ajeno y conserva original |
| Pantallas | 390, 768 y 1440 px; límites de ancho del panel y página; capturas sintéticas para revisión |
| Red | Ninguna solicitud a origen externo, servicios reales o secretos; endpoints financieros no ensayados devuelven error, no saldos inventados |

La verificación de dinero, firma, transacción y roles corresponde al ensayo Mongo autorizado previo (81/81). Esta suite de navegador usa API simulada y no sustituye esa evidencia. Tampoco acredita dispositivos físicos, Safari/WebKit, experiencia táctil ni operación real de Render/Mongo.

## Estado inicial y límites

Chromium existe localmente, pero no pudo abrir su socket por la restricción del sandbox (Operation not permitted). La política de aprobación rechazó ejecución fuera del sandbox; no se alteró ni eludió. CI aislada es la alternativa para observar ejecución. Resultado de la nueva prueba, revisión visual de capturas y CI exacta pendientes; no declarar aprobación antes de obtenerlos.

Capturas de ensayo se conservan como artifact de CI siete días, con SHA exacto; son evidencia reproducible, no copias de datos de usuarios. Registrar resultados y límites versionados. Permisos Mongo reales, custodia independiente, copia independiente protegida/retención y restauración operacional con RPO/RTO, revisión independiente #407 y dispositivos reales siguen pendientes.

Siguiente: usar la matriz consolidada para priorizar fallos observados y criterios abiertos, sin variantes cosméticas. Sin merge a feature, Render, cambios a main/Empresarial/Blushéa ni datos reales. No se crean servicios ni planes de pago.
