# Archivo recuperable del calendario — r83

## Plan y alcance

PR389 abierto/sin fusionar, rama integration/fp-hormiga-clasificacion-credito-v81; padre real comprobado 3966d400098f129f225979f2fada10623ee38c23, árbol c67b4242cfed1aa4ba69184bd7f43be67b60947c. Base autorizada feature/finanzas-personales 652126a03f19fbec3c529cad1e84bff11cd3699e. #407 es una incidencia abierta y conserva sus seis criterios. Sus permisos/custodia/gate independiente/despliegue no quedan acreditados por esta mejora local.

Un bloque: superar la lista activa de100 solicitudes de calendario sin podar ni sobrescribir originales, manteniendo consulta y copia/recuperación cifrada de páginas. Solo calendario personal, sus pruebas, HTML/versionado y documentación. No cambia cálculos, rutas ni datos MongoDB, dependencias, gates, Empresarial, Blushéa o main. El pendiente de gastoInteligentePersonal.service.js consta resuelto en el checkpoint inicial (fecha futura válida y requisitos estrictos); no se repite.

## Criterios de aceptación

| Criterio | Comportamiento / evidencia |
| --- | --- |
| Consentimiento explícito | Archivar1–100 solicitudes cerradas exige plan ligado a dueño, SHA256 exacto de raíz y cantidad. Sin confirmación, sesión vigente o plan actual, no libera la lista |
| Cierres verificables | CONFIRMADA requiere recibo ligado al cuerpo, usuario, ruta, acción y versión mediante validador existente. RECHAZADA requiere prueba verificable ligada; PENDIENTE y rechazo legado sin prueba bloquean archivo |
| Originales antes de liberar | Página exacta en gruk.fp.calendario.v81:usuario:archivo:SHA, lectura comprobada antes de publicar raíz con referencias y lista vacía. Formulario actual intacto; ninguna clave se borra |
| Fallo parcial | Cuota o escritura ignorada en página/raíz no libera lista; reintento reutiliza huérfano idéntico, rechaza conflicto y conserva fuentes |
| Capacidad acotada |100 activas +20 páginas de1–100 cerradas (máximo2100); límite explícito sin poda ni rotación. Claves únicas en toda colección, referencias ordenadas con prefijos íntegros |
| Consulta accesible | Ver solicitudes archivadas muestra originales/recibos en details y textContent adaptable; no interpreta HTML, no envía cambios ni presenta histórico como estado financiero actual |
| Copia compatible | Sin páginas conserva FP_CALENDARIO_LOCAL_V1; con páginas V2 incluye originales exactos. Mismo AES-GCM/PBKDF2 y límites del transporte existente; sin alternativa débil ni almacenamiento de frase |
| Recuperación idempotente | Verifica dueño/tipo/referencias/huellas/cierres. Páginas y acuse antes de raíz, sin reemplazar otro diario o archivo. Reimportar copia conocida busca también entradas archivadas y conserva recibos/formularios/solicitudes posteriores |
| Sesión y concurrencia local | Controles bloqueados mientras archiva/copia/consulta; cambio de sesión o formulario durante verificación impide liberar lista. Salir limpia vista de archivos, conserva almacenamiento original |
| Finanzas intactas | Archivo/copia/recuperación no registran ingresos ni repiten pagos. Pendientes activos mantienen el bloqueo C3; no se limpia el diario financiero general |

## Pruebas reproducibles

```bash
node --test test/finanzas-personales/archivoCalendarioPersonal.test.js test/finanzas-personales/copiaCalendarioPersonal.test.js test/gruk/frontend-version-aislamiento-personal.test.js test/gruk/hormiga-version-javascript-personal.test.js
node --test test/finanzas-personales/*.test.js
npm run ci:personal
# Solo entorno sintético autorizado del workflow V81, nunca producción:
node --test test/finanzas-personales/browser/backend-recuperacion.browser.cjs
```

Diez pruebas nuevas cubren100/101 y reintento con página nueva, colisión de clave archivada, pendientes/rechazos sin prueba/rechazo persistido válido, usuario/sesión/formulario/plan, cuota y escrituras ignoradas en página/raíz, corrupción/referencias/duplicados, límite20, exportación/recuperación V2 y compatibilidadV1, fallos en página/acuse/raíz y conflictos, carreras asíncronas, UI con confirmación, texto literal, formulario conservado y limpieza de sesión sin API implícita. Las diez pruebas de copia anteriores permanecen.

Local: dirigidas23/23, módulo742 pruebas/733 aprobadas/9 omisiones por servicios externos; cero fallos. ci:personal y sintaxis sujetos al resultado registrado en cierre. Node24 local frente Node20 CI. No se afirma ejecución local de MongoDB autorizado o navegador nativo; se exige CI del SHA publicado. No se relajan gates, límites de autenticación ni timeouts.

Prueba nativa ampliada en el caso de calendario existente: POST real con respuesta perdida, 401 con misma clave/cuerpo y fuente intacta; copia recupera pendiente y exige GET propio antes de cerrarlo. Después archiva con consentimiento, compara página/formulario exactos, consulta local, reimporta copia anterior sin volver pendiente, descarga copia con archivos y recupera en tercera pestaña/login real. Compara fuentes financieras y calendario, cero POST/GET de recibos adicionales por archivo/copia y ancho390 sin desborde. FP_ARCHIVO_CALENDARIO será la evidencia de CI; no se da por aprobada antes de ejecutarla. Sigue la aserción429 real de la cuenta compartida agotada; se usan identidades independientes para copias.

## Evidencia previa y checkpoint

Padre3966d400: Gate43305174002, Seguridad43305174038 y V8143305174099 success comprobados antes de actuar. El bloque anterior de capturas ya está cerrado, no se vuelve a implementar. Publicar este lote con árbol local/remoto idéntico y expected_sha/force=false; confirmar el SHA exacto, registrar fallos si aparecen y conservar checkpoint recuperable.

## Límites y siguiente paso

Páginas en sessionStorage no son backup independiente ni durabilidad garantizada. Hash local detecta discrepancias comparadas con sus referencias, no defiende contra quien controla navegador o reescribe referencias coherentemente; recibos locales no son firma/certificación externa. Rechazo VERSION_SUPERADA es una observación ligada al estado visto, no prueba de decisión append-only persistida; RECEPCION_NO_APLICADA sí exige decisionPersistida en el validador. Ningún archivo acredita estado vigente, llegada futura de ingresos o saldo bancario. Los recibos activos pueden contrastarse por GET autenticado; esta vista de archivo muestra originales locales históricos.

Máximo8MiB de contenido portable/12MiB de archivo cifrado, raíz/página hasta1MiB para recuperar. Textos grandes/cuota pueden limitar antes de2100 entradas; exceso se rechaza sin recorte. No hay autoarchivo ni borrado al salir. Descargar es explícito y la frase perdida no se recupera; no sustituye backup Mongo independiente ni ejercicio de restauración aislado. Dispositivos físicos y rendimiento máximo no acreditados.

Siguiente: capacidad recuperable del diario de imputaciones, conservando originales y constancias. #407/custodio independiente real/backups independientes con retención/acceso/credenciales separadas/restauración operacional aislada-RPO-RTO/roles e índices Mongo productivos/auditoría-dispositivos-compatibilidad siguen pendientes. Mantener sin merge a feature ni Render y sin costos nuevos. Tarea activa; sin prometer ejecución ininterrumpida.

Validación adicional previa: ci:personal353/349/4, cero fallos, sintaxis completa aprobada. Las cuatro omisiones se identifican separadas y no se atribuyen a validación operativa. git diff --check sin errores.

## Resultado publicado y verificado

Código **6f5adfdf3e7cb2b3079cd8ca20b96cc55975509d**, árbol **0ca258e827a417e6b0f89414eed651d1297be427**; ocho archivos personales cotejados y actualización con lease.

- [Gate43314537584](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43314537584): success.
- [Seguridad43314537578](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43314537578): success.
- [V8143314537572](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43314537572): success.
- [Job autorizado131518977052](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43314537572/job/131518977052): Mongo81/81, navegador/backend15/15, cero fallos/cancelaciones/omisiones.

FP_ARCHIVO_CALENDARIO confirmó con datos sintéticos archivo explícito, bytes originales y formulario posterior intactos, consulta literal, reimportación de copia anterior idempotente, descarga cifrada con archivos, tercera pestaña/login reales, recuperación de páginas exactas y ancho390 sin desborde. Cero POST o nuevos GET de recibos por archivar/recuperar, calendario y finanzas intactos. FP_COPIA_CALENDARIO también completo: cuota429 real, copia ajena rechazada, pendiente bloquea C3 y un GET propio antes de cerrar. Se resuelve para el SHA de código la ejecución nativa antes indicada como pendiente.

Módulo local742/733/9, dirigidas23/23, ci:personal353/349/4, cero fallos. Sin cambios a gates, timeouts o cuotas y sin omitir casos. Comprobar las tres CI del descendiente documental exacto al cierre; evidencia y SHA también en PR389. GitHub publicado, sin merge a feature ni Render. Permanecen todos los requisitos externos y límites anteriores; tarea recurrente comprobada habilitada.
