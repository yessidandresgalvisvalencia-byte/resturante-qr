# Interfaz de adopción recuperable — V81

2026-11-05, Colombia. Padre remoto verificado `877fbe81864fce7270dc55b471545b593dc1d62b`, árbol remoto/local idéntico `2857bfdb2aeec47e168dae0aec1399c23c384ed6`. #389 abierto sobre feature/finanzas-personales (`652126a03f19fbec3c529cad1e84bff11cd3699e`), #407 abierto. CI del padre: Gate 42089986662, Seguridad 42089986594 y V81 42089991034 success.

## Comportamiento entregado

En Calendario de ingresos, un registro anterior propio y válido permite «Adoptar este calendario». Muestra identidad/huella de fuente y estado original. Concepto, monto y día se copian para revisión y quedan de solo lectura; fecha prevista y motivo empiezan vacíos, sin reutilizar una fecha histórica o inventar recepción. La fecha y el motivo escritos explícitamente se recuperan después de recargar la pestaña.

«Confirmar adopción» muestra de nuevo concepto, monto, fecha prevista, ID, huella y conservación del estado activo/inactivo. Cancelar no genera petición. Se comprueba listado/propietario/huella/estado antes y después de confirmar, junto con revisión financiera y operaciones pendientes. Si cambió la fuente o ya existe su calendario gestionado, exige consultar y revisar otra vez antes de crear una solicitud.

La solicitud ADOPTAR conserva versionEsperada 0, huella exacta y clave estable antes del POST a la identidad original. sessionStorage conserva cuerpo/ruta/selección por propietario y admite el nuevo tipo sin eliminar peticiones anteriores. Si el almacenamiento falla, no envía. Tras perder la respuesta puede consultar el recibo por GET; ese recibo debe coincidir con la solicitud completa y la identidad, mediante el control financiero y la función api reales existentes. No se crea otra clave para recuperar.

Si no aparece recibo, la adopción permanece pendiente. Reenviar es una acción manual y usa exactamente cuerpo/ruta/clave guardados. Un 409 genérico permanece incierto: no se libera una operación sin evidencia vinculada de rechazo; la prueba de versión superada existente solo resuelve la solicitud que coincide. No se inventa un resultado ni se borra una petición para continuar.

Originales grandes, incompletos o inválidos siguen visibles; su botón de adopción queda deshabilitado. Los ya adoptados se muestran como evidencia vinculada al gestionado, sin ofrecer otra adopción. Una adopción inicialmente inactiva se restaura mediante el botón normal del gestionado y el hash exacto, conservando el original. Nada de este flujo registra caja, ingreso recibido, pago o deuda.

## Aceptación y evidencia

| Caso | Verificación |
| --- | --- |
| Confirmación y revisión de original | DOM: fecha vacía, campos originales de solo lectura, huella/estado visibles; cancelar conserva formulario y no crea solicitud |
| Respuesta perdida | DOM y helper HTTP: la petición ya está persistida; recargar recupera campos/selección; GET del recibo confirma sin repetir POST |
| Reenvío e incertidumbre | GET 404 conserva pendiente; solo reenvío manual repite cuerpo y clave exactos; los 409 no vinculados no se descartan |
| Fuente desactualizada o importe manipulado | No genera petición ni POST; requiere revisar de nuevo la fuente |
| Fallo de almacenamiento | Bloqueo previo al POST, datos visibles conservados |
| Fuentes no adoptables | Siguen visibles, con botón deshabilitado; no hay limpieza o modificación automática |
| Cambio de sesión | La respuesta tardía no se dibuja para otra identidad ni confirma su petición; el pendiente del dueño sigue conservado |
| HTTP/control financiero/Mongo real | Helper existente ampliado: pérdida de respuesta después de commit de ADOPTAR, recarga, recibo GET, estado original inactivo, restauración explícita y ventanas únicas de planificación; cuentas/transacciones/outbox y fuente permanecen iguales |
| Regresiones | Calendario crear/corregir/retirar/restaurar, captura, versiones de assets y dictado por sesión conservados |

Archivos: public/finanzas-personales-calendario.js y HTML; calendarioInterfaz.test.js, helpers/calendarioInterfazAutorizada.js, pruebas de versión. Assets personales versionados `20261105-calendario-adopcion-interfaz-v81`; CSS/service worker y otros productos sin cambios. API/modelos/índices/roles/backup V18 no cambian en este bloque.

Local Node24: 503 casos del módulo/494 aprobados/nueve omitidos/cero fallos; 32 dirigidas de interfaz/dictado y otras 33 de versiones/privilegios/backup aprobadas. Sintaxis general/diff correctos. Nuevos controles de fuente se verificaron de nuevo en las 32 dirigidas. El job Node20/Mongo autorizado del SHA publicado debe aprobar antes de cerrar el bloque; sus resultados se añaden al confirmarlos.

## Límites y pendientes

DOM/controlador/HTTP no equivalen a aprobación visual en dispositivos. Se comprobó que no hay ejecutables Chromium/Firefox disponibles para Playwright en este entorno; no se inventan capturas ni aprobación de escritorio/iPhone/Android. La medición de demora/fecha en producción sigue pendiente. sessionStorage está limitado a la pestaña/origen/capacidad 100; no es una copia independiente ni protege frente a XSS del mismo origen. No hay limpieza automática, exportación o archivo nuevo en este bloque.

La integración usa la API de CALENDARIO_ADOPCION_API_V81.md: misma identidad, copia BSON y huella, sustitución única por ID y original protegido. No resuelve duplicación semántica entre originales distintos, corrupción administrativa o referencias históricas rotas mediante reparaciones. Fuente inválida/pago incierto requiere revisión, nunca desactivar gates o reenviar con una clave nueva.

Siguiente: recepción explícita por ocurrencia, con cuenta, fecha y monto confirmados; recibo idempotente y evento atómico sin duplicar caja ni perder original/planificación. Completar también aceptación visual/dispositivos y flujo de exportación/archivo de pendientes sin borrar evidencias.

#407, custodio independiente real, backup durable completo/retención/acceso/claves separados, recuperación operativa aislada y RPO/RTO productivos, roles/índices/históricos reales, seguridad/compatibilidad/visual/informe final siguen pendientes. No merge a feature ni Render; sin main/Empresarial/Blushéa, nuevos servicios/costos, migraciones o mutaciones/restauración de datos reales.
