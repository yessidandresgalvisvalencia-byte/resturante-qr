# Nueva observación de fuentes del diario · V81

## Plan y alcance r74 · 12 noviembre 2026

Padre remoto comprobado `81b9894a5e2615f8d45899b953636903fa6cde70`, árbol `83ea95bbabc429e0fa04e0e7ff9fd28d30e5ca55`. #389 abierto, integración `integration/fp-hormiga-clasificacion-credito-v81`, base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`. Gate 43195709208, Seguridad 43195709247 y V81 43195709122 del padre verdes. #407 sigue abierto. README/instrucciones/continuidad revisados, sin AGENTS.md local. No se repite gastoInteligentePersonal: las condiciones estrictas y fechas del próximo ingreso constan implementadas y verificadas en continuidad.

Un bloque funcional: desde solicitudes cerradas del diario o páginas archivadas, consultar una nueva observación de la fuente y contrastarla con el recibo/constancia original sin sustituirla. Una fuente anulada puede restaurarse después y una fuente con compensaciones puede corregirse otra vez: la constancia anterior conserva su significado histórico. No confundir CORREGIDA (fuente con compensaciones) con un tipo de evento concreto.

## Aceptación

1. Solo lectura financiera mediante POST /transacciones/constancia-intento existente, JWT personal y caché privada no-store. Ninguna llamada para registrar, restaurar, corregir, autorizar gasto o resolver pendientes. Solo entradas cerradas CONFIRMADA/HISTORICA propias y verificadas.
2. Contrastar propietario, cuerpo normalizado completo, UUID y transaccionId. Para constancias históricas verificar ambas huellas y fuenteHash idéntico. Recibo antiguo debe ser confirmación activa vinculante; una respuesta genérica o otra identidad no basta. El cliente coteja estructura y hashes, no dispone de la clave HMAC del servidor.
3. Distinguir MISMA_OBSERVACION, OBSERVACION_DISTINTA y RECIBO_ORIGINAL_CONTRASTADO. Dos compensaciones con el mismo estado visible cambian hash y deben detectarse. No inferir importe vigente, balance, orden cronológico, restauración o condición bancaria a partir de esas etiquetas.
4. Conservar bytes de solicitudes/constancias/archivos/controles de incertidumbre. Nueva observación solo en vista, no guardarla sobre evidencia previa. La interfaz explica snapshot y ausencia de autorización de gasto. Una recarga o salida descarta esa vista; se puede consultar de nuevo.
5. Descartar respuestas tardías de otra sesión o tras cambio observado del diario. Al iniciar consulta retirar el resultado anterior; error de red, ausencia de fuente, hash/propietario/fuente distintos o datos corruptos muestran no verificada, sin filtrar errores internos ni tocar originales. No consulta pendientes.
6. Mismo comportamiento en páginas archivadas, sin reescribirlas ni ejecutar compensaciones. Contenido mediante textContent. Versiones de los tres recursos personales y contratos de caché actualizados juntos.

## Pruebas y evidencia inicial

Siete pruebas nuevas en `test/finanzas-personales/observacionPosteriorManual.test.js`: contraste antes/después, compensaciones sucesivas con mismo estado, identidad/fuente/cuerpo/hash/recibo inválidos, recibo original, API de consulta exclusiva, cero escrituras, error sin resultados obsoletos ni detalles privados, sesión tardía, cambio de diario y rechazo de pendiente. Las pruebas previas de diario/archivo/constancia también pasan.

Local: módulo 655 casos, 646 aprobados/nueve omitidos por servicios de integración; CI personal 353 casos, 349 aprobados/cuatro omitidos; cero fallos/cancelaciones. Sintaxis y diff correctos. No se instala ni cambia dependencia.

CI ampliada en `backend-recuperacion.browser.cjs`: dos escenarios existentes conservan primero constancia ANULADA/CORREGIDA; luego restauración HTTP real de la anulación o nueva corrección HTTP. Verifica una corrección adicional posterior, dos observaciones con hash distinto y fuenteHash intacto, firma real del emisor, snapshot financiero sin cambios por consultar, fuente original Mongo intacta, bytes del diario originales y ningún POST financiero de la UI de consulta. Además consulta un recibo desde página archivada de cien fuentes reales y prueba bytes y finanzas sin cambios. Ensayo con JWT, router y Mongo autorizado restringido; no datos de producción. Aprobado para el código publicado según evidencia exacta siguiente; el descendiente documental requiere también verificar su propia CI.

## Límites y liberación

El resultado es una observación del snapshot de consulta, puede quedar obsoleto inmediatamente y no afirma saldo/importe actuales, recomendación ni garantía de integridad global. Los hashes de fuente cubren los campos financieros seleccionados, no todos los metadatos Mongo. HMAC propio no es auditoría/custodia externa; navegador depende del origen autenticado. No clasifica evento de restauración desde CORREGIDA ni proporciona historial independiente.

La nueva observación no se persiste. La constancia original queda intacta en sessionStorage; este no es respaldo independiente/durable ni protección frente a reescritura coherente de todas las claves por un atacante del mismo origen. Cuotas, pérdida de perfil/pestaña, capacidad y ausencia de CAS multipestaña siguen como límites documentados del archivo r73. Falta exportación/recuperación local verificada y titularidad vinculante para legado sin JWT original. No adivinar ni adoptar por aproximación.

#407 permanece abierto: custodio independiente real, backups completos protegidos con retención/acceso/claves separados y restauración operacional/RPO-RTO, permisos/índices/credenciales productivos, dispositivos físicos/compatibilidad e informe de liberación integral pendientes. No merge ni despliegue Render; no cambios a main/Empresarial/Blushéa/datos reales/planes de pago. No se desactiva gate.

## Siguiente paso recuperable

Revisar HEAD/#389/#407/CI de nuevo. Priorizar exportación y recuperación explícitas del diario por el mismo propietario, con conservación de originales, prueba de cuota/corrupción/duplicados/aislamiento y ningún efecto financiero. Obtener evidencia independiente real para bloqueos externos; no sustituirla por mocks o certificados inventados.

## Cierre funcional verificado

Código `d0f4d49dbf88555b2ec779b83c4ff3a070f1606c`, árbol `31cefc359f6f4ce62085b6d0b6dde2bb356d8b96`. Nueve archivos exclusivamente personales, árbol local y remoto idénticos, publicación con lease expected_sha y force=false.

- [Gate 43203318286](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43203318286): success.
- [Seguridad 43203318236](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43203318236): success.
- [V81 43203318326](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43203318326): success, ocho jobs.
- Job autorizado 131132059782: Mongo 81/81 y navegador/backend 11/11, cero fallos/cancelaciones/omisiones.
- `FP_OBSERVACION_POSTERIOR`: estadoAnterior ANULADA con restauracionReal=true y CORREGIDA con restauracionReal=false (solo correcciones); ambos correccionPosterior=true, proyeccionObservada=ACTIVA, fuenteHashIntacto=true, constanciaOriginalIntacta=true, sinPOSTFinancieroConsulta=true, snapshotSinCambios=true, datos=sinteticos. No se cuenta una segunda restauración que no ocurrió.
- Archivo de cien fuentes reales: nueva consulta desde página archivada aprobada, bytes/finanzas intactos y cero POST de archivo, viewport 390. Siete pruebas nuevas locales; módulo 655/646/9 y CI personal 353/349/4, cero fallos. Las omisiones locales se declaran y no sustituyen la integración autorizada.

Sin gates omitidos/desactivados ni cambios a datos de producción. El resultado no es certificación externa ni aceptación de dispositivos físicos u operación real. #407 permanece abierto; no merge ni Render. SHA documental y CI exacta final se registrarán en el resumen de #389 al cerrar, sin autorreferencia imposible dentro de su propio commit. Siguiente: exportación/recuperación explícita del diario con conservación de originales y evidencia de identidad, corrupción, duplicados, cuota e idempotencia; no adoptar legado sin prueba suficiente.
