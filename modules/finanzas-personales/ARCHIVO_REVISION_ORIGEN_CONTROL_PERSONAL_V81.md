# Archivo explícito de recibos de revisiones específicas — r123

26/11/2026 Colombia. HEAD inicial real7cb37447aa1dedbbf925b882c72d73a48235da3f/árbolfa02fb365e054d876289b41566e08c19c76e18d9; base personal652126a03f19fbec3c529cad1e84bff11cd3699e intacta. PR389 abierto/no integrado, rama integration/fp-hormiga-clasificacion-credito-v81;407 abierto, cuerpo/cuatro comentarios revisados sin nueva evidencia operativa independiente. CI inicial Gate45765290156/Seguridad45765290189/V8145765290340 success. Instrucciones/continuidad/matriz revisadas, sin AGENTS.md adicional. No repetir fechas/compra/recuperación GET ya cerradas.

## Un bloque y aceptación

Archivo explícito para liberar capacidad activa del registro dedicado de recibos de revisión sin borrar originales, resolver solicitudes pendientes ni modificar finanzas. No es una copia fuera del navegador.

1. Lee formato1 existente y formato2 con lista ordenada de hasta20 páginas archivadas. Cada página conserva el texto exacto de la raíz anterior en una clave por usuario/hash SHA256. Verifica propietario, estructura, hash de bytes, continuidad de prefijos y cada solicitud/recibo; duplicados, páginas ausentes/alteradas, mezclas de dueño o ciclos/listas incoherentes fallan cerrado. Límite100 activos y20 páginas de hasta100 recibos, sin poda automática.
2. Plan ligado a dueño, huella de raíz, conteo activo y páginas anteriores; confirmacion:true obligatoria en la operación local. Sesión, revisión, operaciones activas, raíz, páginas y registro de pendientes se verifican antes de escribir. Plan obsoleto/otro dueño/operación en curso rechaza. No elimina ni resuelve pendientes existentes: puede archivar cierres para liberar capacidad mientras el pendiente101 sigue protegido.
3. Primero guarda la página exacta, sin sobrescribir una clave contradictoria, y verifica lectura; después sustituye raíz por una versión2 con activos vacíos y referencias anteriores. Fallos al guardar página o raíz conservan originales, sin liberar antes de conservar. Reintento del mismo plan reconoce el archivo anterior, no duplica páginas ni archiva recibos nuevos llegados después.
4. Confirmar una solicitud nueva usa capacidad activa; sigue validando todos los recibos archivados para evitar duplicados o cambios de cuerpo/clave/resultado. Consultar por GET un recibo archivado verifica el resultado y conserva archivo y primer original; no lo vuelve a convertir en activo ni aplica finanzas.
5. Pantalla exige confirmación, admite cancelar sin cambios, distingue recibos archivados y conserva su botón de consulta. No envía POST ni GET al archivar; consultar el guardado sí usa GET propio. Sesión/época y bloqueo de doble acción existentes se mantienen. Caché JS20261126-archivo-revision-origen-v81.

## Pruebas previstas

Cinco pruebas nuevas offline:100 recibos y pendiente101, capacidad liberada y confirmación posterior; fallos de escritura de página/raíz y reintento; plan obsoleto/dueño/sesión/página alterada; límite20 páginas sin pérdida; pantalla/cancelación/GET sin reactivar. Ocho regresiones de recuperación mantienen aislamiento, recibo antes de resolver y fallos de almacenamiento. Chromium390/login real debe archivar dos recibos propios, verificar cancelación, original exacto,0 activos/2 archivados, pendientes/caja intactos y GET de archivado sin POST ni reactivación; peticiones observadas en el navegador. Se amplía un escenario existente, sin cambiar cuotas/timeouts. Resultados finales locales/CI propia pendientes de verificar.

## Compatibilidad, límites y siguiente paso

Formatos1/2 con la misma clave por dueño. Nuevos lectores aceptan la raíz anterior intacta; lectores previos rechazan formato2, por lo que una liberación requiere cliente compatible, sin versión parcial en producción. No cambia esquema MongoDB, roles, índices ni formato BSON del backup. Archivo no modifica eventos, caja o pagos ni afirma su origen real.

Hasta20 páginas/100 activos: al alcanzar capacidad, se conserva todo y se bloquea nuevo archivo. No garantiza durabilidad física del navegador, aislamiento contra JavaScript comprometido, custodia independiente ni recuperación ante pérdida del dispositivo. La copia cifrada/recuperación portable del registro dedicado aún no está implementada; otros diarios no incluyen automáticamente estas páginas. Los pendientes antiguos sin cuerpo no se reconstruyen por saldo. No hay botón nuevo de cierre backend.

Siguiente bloque prioritario: copia cifrada y recuperación explícita de raíz/páginas originales y solicitudes dedicadas, validación previa completa, destino vacío o adopción expresamente verificada, sin sobrescribir otro diario y exigiendo GET de recibos importados antes de resolver/asesorar. Después cierre con consentimiento en pantalla y adopción verificable de legados sin cuerpo. Antes de retomar HEAD/base/PR389/issue407/CI/instrucciones/CONTINUIDAD y este cierre.

#407/release sigue pendiente: custodio independiente real/anclas, backup durable/retención/acceso/credenciales separadas/restauración operativa aislada/RPO-RTO, roles/índices/migración/configuración reales, Safari/dispositivos/auditoría independiente/compatibilidad/informe final. Sin merge a feature, Render/main/Empresarial/Blushéa, datos reales alterados, migraciones/restauraciones productivas ni costos nuevos. Tarea activa, sin garantías absolutas ni certificación inventada.


Validación local previa a publicación r123:5/5 casos nuevos y13/13 dirigidos con recuperación,7/7 contratos de caché; módulo1016 casos/1007 aprobados/9 omitidos por integración no configurada,0 fallos/cancelaciones; ci:personal353/349 aprobados/4 omitidos por Mongo no configurado,0 fallos/cancelaciones. Sintaxis y diff correctos. CI real del SHA propio todavía pendiente; no se atribuye la evidencia del padre al código nuevo.
