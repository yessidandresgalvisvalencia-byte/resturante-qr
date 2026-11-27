# Cierre de solicitudes de retiro — API r138

26 de noviembre de 2026. Solo Finanzas Personales. HEAD inicial confirmado6f94989b7f6e1b7fa8f5b7f9c7cd80391cd30bc4/árbol7b624a0cebdb008d2b9fd3b847c53d5b324023f8. PR389 abierto/no integrado; basefeature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. Issue407 y4comentarios releídos: abierto/sin evidencia externa nueva. CI inicial Gate45913880682/Seguridad45913880625/V8145913880660 success.

## Alcance y decisión

Un bloque de API: cerrar explícitamente una solicitud propia no aplicada, conservar su cuerpo original y recuperar recibo sin volver a retirarla. No incluye aún botón/cierre durable del navegador, copia de recibos cerrados ni archivo: esos criterios permanecen pendientes para el siguiente bloque. El cliente anterior rechaza el recibo de cierre desconocido y mantiene pendiente; no se cambia el cliente para aceptar una confirmación falsa. No se publica a producción una API sin el flujo completo.

La historia financiera de retiro/restauración alterna ambos eventos y su cursor/paridad se usa para recuperar la deuda. No se inserta un falso retiro, restauración o cierre dentro de esa cadena. Nueva colecciónfin_resoluciones_retiros_deudas_personales_v1: resoluciones APLICADA/CERRADA con solicitud original exacta, hash de evento aplicado cuando corresponde, SHA256 previo/actual, contexto privado y cursor independiente por deuda. Los nuevos actos aplicados escriben resolución dentro de la misma transacción financiera; historias antiguas se leen sin inventar resoluciones retroactivas.

La clave única(usuarioId,solicitudId) se comparte entre aplicar y cerrar en esta colección. Impide que ambas decisiones ganen, incluso para deudas distintas. Índice único(usuarioId,prestamoId,secuencia) y cursor independiente detectan carreras y truncamiento. El nuevo cursor se excluye de la foto financiera, conservando los bytes/hashes históricos y la referencia de restauración. No se confunde el hash de resolución con el hash del retiro.

## Contrato y aceptación

POST /prestamos/:id/retiros/cerrar-solicitud, JWT+entitlement personales, no-store y limitador seleccionado existente (gate Redis de producción intacto). Cuerpo exacto:

```json
{"confirmacionCierre":true,"solicitud":{"metodo":"DELETE","path":"/prestamos/ID_PROPIO","cuerpo":{"confirmacion":true,"solicitudId":"CLAVE_ORIGINAL"}}}
```

Para restauración: metodoPOST, path/ prestamo propio/restaurar-retiro sin espacios, cuerpo original incluye retiroHash exacto. Usar rutas reales /prestamos/<id>/restaurar-retiro; los marcadores del ejemplo no son IDs válidos. No aceptar usuarioId/contexto/otros campos del cliente. Preservar clave y cuerpo aun ante error/timeout; un404 no cierra.

- No aplicada: resolución CERRADA y outbox con acción de cierre, captura contextual HTTP previa al escritor y cursor en transacción snapshot/majority. Deuda/estado/calendario/saldo/caja/pagos/fuentes originales no cambian; solo metadatos de resolución y updatedAt de proyección, resolución nueva y outbox. Fallo de outbox revierte todo.
- Ya aplicada: devuelve recibo original; jamás se presenta como cerrada ni deshace el retiro. Repetición del cierre devuelve mismo recibo sin contexto nuevo/clave actual requerida; cuerpos/deudas distintos con la misma clave rechazan.
- GET existente /prestamos/:id/retiros/recibos/:clave reconstruye resultado propio. Recibo de cierre conserva ruta/método/cuerpo comprometido y añade resolucion=CERRADA_SIN_APLICAR,afectaCaja=false,autorizaGasto=false,certificaEstadoActual=false. No debe interpretarse como RETIRO o RESTAURACION aplicada. Cliente nuevo deberá discriminar resolucion antes de confirmar.
- Aplicación posterior de clave cerrada rechaza409; nueva solicitud explícita con otra clave sigue su validación normal. Cerrar una restauración no impide una restauración nueva con la referencia vigente.
- Cadena de resoluciones exige propietario/préstamo/solicitud/secuencia/contexto/fecha/hash/cursor y vínculo al evento para APLICADA; CERRADA exige ausencia de evento y contexto HTTP. Historial/recibo y escritores verifican cadena; ni lectura ni replay la reparan.

## Persistencia y operación

Modelo solo INSERT, política de aplicación27colecciones protegidas. Provisionamiento administrativo existente descubre modelo/crea colección e índices sin drop/sync; nuevas escrituras fallan503 si faltan índices exactos, no los crean desde HTTP. Separación de credenciales administrativas/aplicación y verificación de privilegios reales siguen obligatorias. RespaldoV33 incluye46colecciones; V32 conserva45, V31 y anteriores mantienen alcance exacto, sin inventar la colección ausente. No se ejecuta provisión ni migración en producción.

Capacidad1000resoluciones por deuda, sin purga. No es retención/backup operativo independiente. Hash y contexto no impiden modificación por administrador que reescriba toda la cadena y cursor: custodia independiente sigue pendiente. La aplicación restringida no debe poder UPDATE/DELETE de la nueva colección.

## Validación, límites y siguiente paso

Local:61/61 dirigidas iniciales; módulo1121casos/1112aprobados/9omisiones por integración no configurada;ci:personal353/349/4omisiones,0fallos/cancelaciones. Ajuste de mock para representar nuevo INSERT de resolución entre evento y proyección: mantiene captura antes del primer escritor y mismo contexto entre retries. La primera ejecución del mock falló por su expectativa anterior; no se retiró ninguna protección real.

Helper Mongo autorizado añadido: HTTP real/otro dueño/rechazos/ausencia de recibo, clave contextual ausente, rollbackOutbox, doble cierre, aplicar versus cerrar en misma y distinta deuda, consulta/replay sin clave actual, cierre de ya aplicada devuelve aplicación, restauración con otra clave, privilegios efectivos y adulteración administrativa sintética detectada sin reparación. Marker FP_CIERRE_RETIRO_MONGO debe verificarse en CI exacta; no se presume éxito por CI del padre. Chromium/backend existente se ejecuta de regresión, no prueba botón de cierre que aún no existe.

Siguiente: cliente durable que distingue recibo cerrado/aplicado, confirma cierre con solicitud conservada, consulta GET tras respuesta perdida, libera solo el control correspondiente y conserva cierres en copia cifrada/recuperación/verificación; probar recarga/cambio de usuario/carrera de pestañas. Después archivo a capacidad sin purga. No convertir un404 en cancelación ni inventar cuerpos de solicitudes antiguas.

#407/custodio y anclas reales, backup independiente/retención/acceso/credenciales, restauración aislada/RPO-RTO operativos, roles/índices/configuración/migración reales, dispositivos/carga/auditoría independiente/compatibilidad/informe final permanecen pendientes. Sin merge/Render/main/Empresarial/Blushéa/datos reales/costos. Publicar con HEAD/expected_sha/force:false, verificar CI del código y del checkpoint, actualizarPR389 preservando descripción. Tarea activa.
