# Copia propia del diario de imputaciones V81

## Alcance y plan r78 · 2026-11-12
Padre verificado `f6d78d6b2c0009100e7eac2096b412d94095be18`, árbol `fb74bc4d11003dd4eefcf877820cd0b49b96a1ed`; integración `integration/fp-hormiga-clasificacion-credito-v81`, PR #389 abierto; base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`. #407 sigue abierto. CI del padre verde: Gate 43234129566, Seguridad 43234129580, V81 43234129052; Mongo autorizado 81/81 y navegador/backend 11/11, job 131236850893.

Un bloque: descargar y recuperar explícitamente el diario propio de imputaciones en otra pestaña. Conservar solicitudes, cuerpo, ruta, clave, recibos y formulario. Importar nunca envía la decisión ni cambia reservas, caja o capital; consultar un recibo posteriormente es una lectura explícita. El diario pendiente bloquea C3 aunque no exista el registro general de incertidumbre.

## Criterios de aceptación
- Paquete tipado `FP_IMPUTACIONES_LOCAL_V1` / `IMPUTACIONES_SIN_CAJA` vinculado al propietario; rechaza paquetes manuales/de restauración, otra cuenta y frase incorrecta. Permite JWT renovado del mismo usuario.
- Usa el cifrado compartido AES-256-GCM y PBKDF2-SHA256 (600000 iteraciones), sal/IV aleatorios; frase de 16–256 caracteres. No añade JWT ni guarda/envía frase. Sin alternativa criptográfica débil; frase perdida no recuperable.
- Verifica cuerpo completo, contexto, motivo, identificadores, máximo 100 entradas y un pendiente. Recibos cerrados deben coincidir con usuario/ruta/cuerpo/clave/estado y el validador existente. Pendiente con recibo contradictorio falla. Estas comprobaciones locales no equivalen a certificación externa ni verifican por sí mismas una firma del servidor.
- Confirmación explícita; acuse antes de raíz y lectura de comprobación. Rechaza otro diario existente/corrupto sin sobrescribirlo. Fallos de cuota/escritura ignorada permiten reintento; no borra acuses ni originales. Raíz máxima 1 MiB; sobre de transporte con límites compartidos. No poda automática; capacidad ampliada queda pendiente.
- Reimportación idempotente conserva recibos, entradas y formularios posteriores. Borradores visuales existentes no se reemplazan. Formulario recuperado se muestra solo si la vista sigue vacía y sin cambios; préstamo se selecciona solo tras nuevo listado propio. Un borrador que guarde una raíz local durante la importación causa rechazo seguro del reemplazo.
- Activación nueva invalida cifras/asesoría/lecturas previas sin borrar otros diarios/borradores. Resolver recibo aumenta revisión; liberar ocupado antes de pintar permite consulta posterior. Cambio de sesión descarta respuestas tardías, limpia frase/archivo y restablece controles.

## Evidencia y reproducción
`node --test test/finanzas-personales/copiaImputacionesPersonal.test.js`: 10/10, cero fallos. Incluye tres estados, exportación cifrada, contratos erróneos, recibos ajenos/cuerpo diferente, cancelación, cuota en ambos pasos, escritura ignorada, raíz corrupta, cambio de sesión, recuperación idempotente, borradores y bloqueo C3 sin diario general. Consulta de recibo usa GET sin POST.

`node --test test/finanzas-personales/*.test.js`: 693 casos, 684 aprobados, 9 omitidos por requisitos de entorno, cero fallos/cancelaciones. `npm run test:finanzas-personales`: 353 casos, 349 aprobados, 4 omitidos, cero fallos/cancelaciones. Sintaxis JS/CJS y `git diff --check` correctos. No se presentan las omisiones locales como pruebas operativas aprobadas.

`test/finanzas-personales/browser/backend-recuperacion.browser.cjs` añade dos escenarios con Mongo autorizado y rutas HTTP reales: fuente/pago sintéticos, POST original confirmado y respuesta abortada; descarga real; otra pestaña con login, rechazo de otra cuenta, bloqueo visible de C3, GET de recibo propio y exportación cerrada. Reimportar conserva borrador y recibo posterior. Contadores exigen cero POST de copia y un GET de recibo; snapshots y fuente original intactos. CI exacta del SHA publicado pendiente: registrar resultado real antes de declarar cierre; no retirar escenarios ni desactivar gates.

## Límites y siguiente paso
Solo diario local de imputaciones, no todos los diarios ni MongoDB. No es backup independiente protegido, retención o restauración operacional con RPO/RTO. Entorno de CI aislado con datos sintéticos; no acredita roles/índices/credenciales productivos, dispositivos físicos o una auditoría externa. #407/custodio independiente/backup-restauración operacional/compatibilidad siguen pendientes. Sin merge, Render, otros productos, datos reales ni costos nuevos.

Siguiente: verificar CI exacta y conservar sus SHA/jobs; continuar diarios de calendario/captura y capacidad sin poda. Obtener evidencia externa real para #407 antes de considerar integración/despliegue final.
