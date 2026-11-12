# Continuidad del diario manual por páginas · V81

## Alcance y plan del lote r73 · 12 noviembre 2026

Padre remoto comprobado: `1770fd570eefe5f8fc5fcf62cc768dad6442818b`, árbol `8811051055e48940658106da0a5531359f703798`. PR #389 abierto, base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`, integración `integration/fp-hormiga-clasificacion-credito-v81`. Sus tres CI estaban verdes; #407 permanece abierto. README, instrucciones y continuidad revisados; sin AGENTS.md local. No ejecución concurrente sobre la rama.

Un bloque funcional: continuar el registro manual tras cien solicitudes cerradas sin podar su evidencia. Antes, cien entradas detenían permanentemente nuevos registros. Se conserva el límite verificable de cien por página; el propietario puede confirmar archivar una página completa y abrir otra. Consulta de página y archivo no llaman a la API financiera. Solicitudes pendientes o legado incierto impiden archivar.

## Criterios de aceptación e implementación

- Consentimiento explícito, identidad derivada de la sesión, página completa sin pendientes, capacidad acotada y snapshot local sin cambios. Rechazar planes obsoletos y cambio de sesión. No generar otra transacción para archivar.
- Copiar primero los bytes exactos del diario original a `gruk.fp.manual.v81:<usuario>:archivo:<SHA256>`. Un archivo existente distinto se rechaza. Releer y comprobar la copia antes de cambiar el diario activo. No borrar ninguna clave.
- Después guardar raíz V2 con referencias ordenadas a archivos anteriores y página activa vacía. V1 continúa siendo legible. Fallo del primer guardado conserva la raíz; fallo del segundo conserva raíz y copia. Reintento reutiliza copia exacta. Un plan ya archivado no vuelve a vaciar una página nueva con registros posteriores.
- Verificar todos los cuerpos/huellas, constancias históricas y huellas de legado antes de operaciones asincrónicas. Comprobar hash de cada archivo, orden de prefijos y UUID únicos en todas las páginas. No reparar automáticamente ausencia, corrupción o discrepancias. No reutilizar UUID archivado.
- Vista histórica accesible al mismo usuario, con solicitud y recibo/constancia completos mediante textContent, sin interpretar HTML y con ajuste de líneas en móvil. Cambiar de sesión limpia vista, no almacenamiento. La evidencia local nunca certifica saldo ni estado actual.
- Capacidad máxima: veinte páginas archivadas y cien entradas activas (2.100 entradas). Al alcanzarla se bloquea otro archivo con explicación; no poda, no eleva límites silenciosamente ni hace limpieza. Verificación acotada; cuotas del navegador pueden agotarse antes.

## Validación reproducible

`node --test test/finanzas-personales/archivoDiarioManual.test.js` cubre archivo normal e idempotente, JWT renovado, aislamiento, cuerpo/legado/constancia conservados, errores de primera/segunda escritura, escritura ignorada, pendientes/legado/página parcial, archivo ausente/alterado/ajeno, dos páginas, UUID repetido, plan obsoleto, sesión y consulta tardía, cancelación, contenido seguro y límite de veinte páginas.

Prueba Chromium/backend `ARCHIVO_DIARIO_MANUAL_CAPACIDAD`: cien fuentes y recibos reales creados por servicios personales con rol restringido sobre Mongo autorizado aislado, raíz sintética construida con esos recibos; login HTTP real, archivo desde interfaz de 390 px, bytes exactos conservados, consulta completa, ninguna llamada financiera de archivo, nuevo registro único por API HTTP, recarga y cambio de propietario. Compara documentos originales y snapshots financieros antes/después. No son datos de usuarios reales; no prueba dispositivos físicos. Se ejecutará en CI para el SHA publicado; no marcar aprobada anticipadamente.

Local previo a publicación: módulo 648 casos, 639 aprobados y nueve omitidos por integraciones externas; CI personal 353 casos, 349 aprobados y cuatro omitidos, cero fallos/cancelaciones. Diez pruebas dirigidas de este bloque y contratos de versión aprobados antes de publicar. CI autorizada exacta pendiente. Registrar SHA, runs y resultado real al cierre en este informe/CONTINUIDAD_V81.md.

## Límites y bloqueos de liberación

sessionStorage es almacenamiento de la pestaña/origen, no respaldo durable, cifrado independiente ni sincronización entre dispositivos. Cerrar/borrar la pestaña, cuota, perfil o almacenamiento puede perder evidencia local; los movimientos del servidor permanecen independientes. SHA local detecta discrepancias respecto de referencias guardadas, no a un atacante que reescriba coherentemente todas las claves. No certifica inmutabilidad ni custodia independiente. La copia y el cambio de raíz son dos pasos, no transacción/CAS multipestaña; guardas y relecturas detectan cambios observados, no prometen exclusión global. No se ha probado restauración operacional de producción.

Un fallo entre pasos puede dejar una copia no referenciada; se conserva y se reutiliza al repetir el mismo plan, nunca se limpia automáticamente. No hay exportación independiente ni adopción de legado sin JWT original, pendientes para un bloque posterior. Una constancia guardada sigue describiendo su snapshot aunque se restaure/corrija la fuente después; probar esa secuencia es siguiente prioridad.

#407 sigue abierto: custodio independiente real, backup completo protegido/retención/acceso/claves, restauración aislada operacional y RPO/RTO, permisos/índices/credenciales productivos, dispositivos y compatibilidad e informe integral pendientes. No autoriza merge ni Render. No se modifican main, Empresarial, Blushéa, datos reales o planes de pago.

## Siguiente paso recuperable

Comprobar de nuevo HEAD/#389/#407 y CI. Verificar constancias históricas tras restauraciones/correcciones posteriores y resolver continuidad del legado cuando falta JWT original solo con evidencia vinculante real. Preparar exportación/recuperación local accesible sin borrar originales. Mantener gates y no desplegar lotes parciales.
