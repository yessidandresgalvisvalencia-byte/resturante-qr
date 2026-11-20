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

## Primer resultado observado
SHA 28e6eb9a12feeae62234add3a885482a3f0f47b9: browser job 130893214263 aprobado, Chromium 151.0.7922.34 y Playwright 1.62.1; cinco pruebas, cero fallos. Cuatro escenarios en HTML real con respuestas sintéticas, sin dispositivos físicos. El job test-v81 falló por aviso nuevo de Mongoose; no declarar CI verde. Parche mínimo y límites en SEGURIDAD_DEPENDENCIAS_V81.md. Se divide salida de capturas en segmentos para evitar truncamiento de líneas en logs; revisión visual de los PNG reconstruidos pendiente.


## Cierre verificado r65 — alcance de aceptación
Código de navegador 28e6eb9a12feeae62234add3a885482a3f0f47b9; corrección auditada e9b0091e795ab8e165977ae43ae89a84cec4a127, árbol bdf8c88fac5f501ba0f1b8e862c80e0af2326842. Tres CI del SHA corregido verdes: Gate 43131034751, Seguridad 43131034516 y V81 43131034629. Job navegador 130894930836: Chromium 151.0.7922.34, Playwright 1.62.1, cuatro escenarios / cinco pruebas aprobadas, sin omisiones. Job Mongo autorizado 130894930652: 81/81, cero fallos y omisiones, con Mongoose 9.11.4. npm ci reproducible, npm audit producción sin hallazgos; gate general y compatibilidad de entrada compartida aprobados. Local con instalación nueva: módulo 613/604/9, CI personal 338/334/4 y contratos lockfile/entrada/CI 21/21. Node local 24; CI verifica el engine 20 del proyecto.

Se revisaron visualmente los PNG de 390, 768 y 1440 px: texto y controles legibles, sin recorte/desborde horizontal del panel; el ensayo también comprueba ancho de página y errores JS. No se alteró CSS por no observar un defecto de layout. Capturas sintéticas preservadas en evidencias/recuperacion-browser-r65; no contienen datos reales y sus identificadores varían entre repeticiones.

| Captura de e9b0091 | SHA256 |
| --- | --- |
| [recuperacion-390-aplicada.png](evidencias/recuperacion-browser-r65/recuperacion-390-aplicada.png) | c90175475a93f6cbfd149523d61b4390d3a82a5106d9f39487ff24800a3ba370 |
| [recuperacion-768-ANULACION_SUPERADA.png](evidencias/recuperacion-browser-r65/recuperacion-768-ANULACION_SUPERADA.png) | c1fd362a2f39b48b8dbca9d9f2f888a3e60c9224ff83e527a698b439f273fd6a |
| [recuperacion-1440-CALENDARIO_NO_VIGENTE.png](evidencias/recuperacion-browser-r65/recuperacion-1440-CALENDARIO_NO_VIGENTE.png) | 4d8febaaddcde4bb0ed5d80b5633cdde8b73bbd54ba594b83fbffd1f4afb8733 |

| Aceptación | Estado y límite |
| --- | --- |
| Fuente, exactitud, firma, concurrencia, idempotencia y rollback | Verificados en ensayo Mongo autorizado del SHA corregido; no acredita configuración de producción |
| Recuperación en HTML real, doble clic, recarga, recibo ajeno, cierre y aislamiento | Verificados en Chromium con API sintética; no equivale a extremo a extremo contra backend real |
| 390/768/1440 px | Automatización y revisión visual de panel aprobadas; no dispositivos físicos ni Safari/WebKit |
| Respaldo V19 aislado | 39 colecciones, 5594 documentos, 3882946 bytes; captura 200 ms, restauración 3785 ms, edad 3952 ms. custodiaIndependiente=false y rpoProduccion=false |
| Custodio/revisión independiente, roles e índices reales, credenciales separadas, acceso/retención de respaldo, restauración operacional y RPO/RTO reales | Pendientes; #407 abierto y liberación bloqueada |

Dos bloques del lote: aceptación de recuperación en navegador integrada a CI y parche compatible de dependencia detectado por gate. El commit posterior conserva este informe/capturas y también requiere CI exacta verde. Siguiente: priorizar aceptación extremo a extremo de navegador contra backend aislado (autenticación y datos de ensayo), sin sustituir revisión/dispositivos/operación independientes ni usar información real. No fusionar a feature ni desplegar Render hasta completar todos los criterios. Main y código Empresarial/Blushéa sin cambios; lockfile compartido revisado solo en rama personal; ningún servicio/plan nuevo.

Limitación local: la política de aprobación rechazó la elevación para iniciar Chromium fuera del sandbox; la ejecución observada y las capturas provienen exclusivamente del runner CI aislado.
