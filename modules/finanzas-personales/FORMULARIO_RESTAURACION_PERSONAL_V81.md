# Borradores recuperables de restauración — r86

## Plan y alcance

Padre real5cb821d59a8bc12c0f4764e34799cd2914230c00, árbol415382a08b0638d5b9e82fdfb0f0aaedfbf69b2c. Base autorizada feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e, integración integration/fp-hormiga-clasificacion-credito-v81, PR389 abierto/sin fusionar. #407 permanece abierto con sus seis requisitos; no se aporta custodia/gate independiente ni configuración productiva ficticia.

Un bloque funcional: conservar formulario aún sin enviar, por usuario y referencia de pago, incluyendo recuperación cifrada y revalidación explícita antes de cualquier restauración. El lote anterior de archivo ya está verificado y no se repite. No cambia cálculos, rutas, MongoDB, ledger, dependencias, gates, Empresarial, Blushéa ni main. El pendiente de gastoInteligentePersonal.service.js consta resuelto en el checkpoint inicial; no se reimplementa.

## Criterios de aceptación

| Criterio | Comportamiento y comprobación |
| --- | --- |
| Borrador tipado | Solo motivo literal hasta240 caracteres sin controles, tratamiento vacío/APLICAR/EXCLUIR y referencia nula o préstamo/movimiento/anulación con formatos exactos. Sin importes, saldos, contexto de cuota o permisos guardados |
| Propietario | Almacenamiento en diario personal por dueño24hex. Renovar JWT conserva sus borradores; cambiar usuario limpia vista y muestra únicamente su colección. Referencias no prueban titularidad: la consulta autenticada posterior la comprueba |
| Sin pérdida al cambiar pago | Conserva hasta100 borradores distintos por referencia, incluido uno sin pago. Actualizar uno conserva los demás; límite rechaza nuevo sin poda. Elegir otro borrador guarda el actual y vuelve a leer el escogido para evitar closures con texto viejo |
| Persistir antes de seguir | Lectura posterior exacta en guardar; cuota/escritura ignorada conserva raíz anterior y texto visual y bloquea revisión/envío. No crea idempotency keys ni solicitudes por escribir texto |
| Revisión fresca | Entrar/recuperar/elegir borrador repone texto y referencia, invalida vista financiera y mantiene Guardar deshabilitado. Consultar pago del borrador es GET explícito; nunca usa contexto, saldo o autorización del archivo |
| Carreras | GET tardío con otra sesión/referencia/edición no reemplaza texto ni habilita revisión vieja. Fallo404/lectura mantiene borrador y Guardar bloqueado. Cambiar de sesión o importar descarta consultas anteriores |
| Copia compatible | V1/V2 previas siguen aceptadas; nuevo FP_RESTAURACIONES_LOCAL_V3 incluye formularios y páginas, con AES-GCM/PBKDF2 existentes. V3 no se acepta como V1/V2 ni con formularios ausentes o contratos incoherentes |
| Recuperar sin sobrescribir | Páginas y acuse antes de activar raíz; no reemplaza otro diario. Reimportar copia conocida conserva texto/estados posteriores y no invalida una revisión actual. Edición durante lectura/importación no se pisa |
| Archivo conserva borradores | Archivar solicitudes cerradas mantiene la colección actual y originales completos de páginas. CopiaV3 contiene ambos; las solicitudes/recibos originales no cambian por editar formulario |
| Sin efectos financieros | Recuperación/elegir/escribir borrador no emiten POST, restauran pagos ni alteran caja/capital/reservas; cualquier operación mantiene consulta y confirmación explícitas existentes |

El formulario es estado de edición mutable, separado de la evidencia financiera append-only. La última edición de la misma referencia reemplaza su texto anterior; no se afirma historial inmutable de cada pulsación. Referencias distintas se conservan. No existe borrado automático, TTL o limpieza al cerrar sesión.

## Pruebas y ejecución

```bash
node --test test/finanzas-personales/formularioRestauracionPersonal.test.js test/finanzas-personales/copiaRestauracionesPersonal.test.js test/finanzas-personales/archivoRestauracionesPersonal.test.js test/gruk/frontend-version-aislamiento-personal.test.js test/gruk/hormiga-version-javascript-personal.test.js
node --test test/finanzas-personales/*.test.js
npm run ci:personal
# Solo runner sintético con MongoDB autorizado aislado, nunca producción:
node --test test/finanzas-personales/browser/backend-recuperacion.browser.cjs
```

Diez pruebas nuevas: varios pagos/sin pago/JWT/usuario,100/101 sin poda, contratos/duplicados/escritura ignorada, V3 cifrada e idempotencia/compatibilidad/propiedad, recarga sin API, cambio de pago/closure anterior/nueva consulta, respuesta tardía/404/sesión, importación sin API y GET explícito/reimportación sin invalidar, edición durante lectura/cuota, archivo con formularios y recuperación exacta.

Local: dirigidas finales32/32 (29 antes de agregar versionado), módulo780/771/9, ci:personal353/349/4, cero fallos. Omisiones por servicios externos no acreditan operación. Node24 local frente Node20 CI; sintaxis aprobada. La primera pasada detectó una aserción antigua que esperaba raíz vacía después de revisar el pago: ahora se conserva formulario. Se actualizó para comparar raíz completa antes/después de escritura ignorada y exigir cero solicitudes/POST, conservando las demás aserciones.

Nativa ampliada RESTAURACION/CIERRE: copia pendiente sigue bloqueando C3; tras GET propio se edita formulario, archiva y exporta V3. Tercera pestaña/loginHTTP real recupera motivo/tratamiento/referencia, mantiene Guardar bloqueado y verifica cero consultas implícitas. Consulta manual de revisión emite un GET real; permite fuente vigente o rechazo seguro404/409/422, sin POST ni cambios de caja/capital/reservas/fuentes. Los dos resultados originales y la prueba de sesión en vuelo permanecen. Pendiente CI del SHA exacto, sin afirmar ejecución nativa local ni modificar gates/timeouts/cuotas.

## Evidencia previa y checkpoint

Padre5cb821d5: Gate43332529263, Seguridad43332529234 y V8143332529353 success comprobados antes de actuar. #407 abierto y sin evidencia externa nueva para cierre. Publicar con árboles local/remoto idénticos y expected_sha/force=false, registrar SHA, CI y fallos si aparecen. Tarea activa; no se promete ejecución ininterrumpida.

## Límites y siguiente paso

sessionStorage no es backup independiente ni durabilidad garantizada; cuota y borrado de datos del navegador pueden impedir disponibilidad. Texto visible cuando falla guardado no se afirma persistido. El borrador no es fuente financiera, estado bancario vigente ni autorización; referencia y hashes locales no acreditan custodia ni propietario sin consulta autenticada. Copias se cifran explícitamente; frase perdida no recuperable. Límite100 borradores y20 páginas de solicitudes,8MiB contenido/12MiB archivo portable; exceso rechaza sin recortar. No hay fusión automática de diarios distintos.

Siguiente: revisar y conservar el formulario de movimiento manual aún sin enviar, con recuperación/aislamiento y sin crear asientos. #407/custodio independiente real/backups protegidos-retención-acceso-credenciales separadas/restauración operacional aislada-RPO-RTO/roles e índices Mongo productivos/auditoría-dispositivos-compatibilidad siguen pendientes. Ensayo390 es navegador sintético, no aprobación de dispositivos físicos ni escala de un millón de usuarios. Sin merge a feature ni Render, costos, otros productos o datos reales modificados.

## Cierre verificado del bloque r86

Código publicado `044228cf820af63cffa7f9ae69c3d50f7f65241d`, árbol `39c63e098f7409b0265772342af72427640747b6`; nueve archivos, árbol local/remoto idéntico. Rama actualizada desde el padre declarado con expected_sha y force=false, sin fusión. Tres workflows success para ese SHA: [Gate43341245172](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43341245172), [Seguridad43341245148](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43341245148), [V8143341245147](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43341245147). Ocho jobs V81 success. Navegador aislado5/5; [job autorizado131609813730](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43341245147/job/131609813730): MongoDB81/81 y navegador/backend15/15, cero fallos, omisiones o cancelaciones.

`FP_FORMULARIO_RESTAURACION` en RESTAURACION y CIERRE confirmó copiaV3, texto/tratamiento/referencia propios recuperados, Guardar bloqueado antes de revisar, cero GET implícitos y un GET explícito por modo. Ambos GET devolvieron409 por estado ya no elegible: rechazo seguro conservando el borrador. Cero POST, originales y fotografía de caja/capital/reservas intactos. `FP_ARCHIVO_RESTAURACION` confirmó original exacto, reimportación idempotente, tercera pestaña con loginHTTP real y390 sin desborde. No acredita éxito200 de esa lectura en backend para este escenario cerrado; respuesta200 con contexto válido está cubierta en pruebas dirigidas. Los otros casos nativos, incluida sesión en vuelo, permanecen15/15.

La automatización existente se comprobó habilitada; no se duplicó ni pausó. Este commit documental descendiente debe pasar nuevamente CI exacta, cuyo resultado final se registra en #389 y se recupera por el historial Git. Un bloque funcional completo; ningún despliegue Render ni integración a feature. Siguiente bloque: formulario de movimiento manual aún sin enviar. Los requisitos externos de #407 siguen abiertos y no se certifican con pruebas sintéticas.
