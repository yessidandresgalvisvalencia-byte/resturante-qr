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

Prueba Chromium/backend `ARCHIVO_DIARIO_MANUAL_CAPACIDAD`: cien fuentes y recibos reales creados por servicios personales con rol restringido sobre Mongo autorizado aislado, raíz sintética construida con esos recibos; login HTTP real, archivo desde interfaz de 390 px, bytes exactos conservados, consulta completa, ninguna llamada financiera de archivo, nuevo registro único por API HTTP, recarga y cambio de propietario. Compara documentos originales y snapshots financieros antes/después. No son datos de usuarios reales; no prueba dispositivos físicos. Aprobada en CI para el SHA 7b83f613ce2957b6db721ea757759ec8a30d0d51; evidencia exacta abajo.

Local previo a publicación: módulo 648 casos, 639 aprobados y nueve omitidos por integraciones externas; CI personal 353 casos, 349 aprobados y cuatro omitidos, cero fallos/cancelaciones. Diez pruebas dirigidas de este bloque y contratos de versión aprobados antes de publicar. CI autorizada exacta aprobada según el cierre siguiente; el descendiente documental requiere también comprobar sus propios workflows.

## Límites y bloqueos de liberación

sessionStorage es almacenamiento de la pestaña/origen, no respaldo durable, cifrado independiente ni sincronización entre dispositivos. Cerrar/borrar la pestaña, cuota, perfil o almacenamiento puede perder evidencia local; los movimientos del servidor permanecen independientes. SHA local detecta discrepancias respecto de referencias guardadas, no a un atacante que reescriba coherentemente todas las claves. No certifica inmutabilidad ni custodia independiente. La copia y el cambio de raíz son dos pasos, no transacción/CAS multipestaña; guardas y relecturas detectan cambios observados, no prometen exclusión global. No se ha probado restauración operacional de producción.

Un fallo entre pasos puede dejar una copia no referenciada; se conserva y se reutiliza al repetir el mismo plan, nunca se limpia automáticamente. No hay exportación independiente ni adopción de legado sin JWT original, pendientes para un bloque posterior. Una constancia guardada sigue describiendo su snapshot aunque se restaure/corrija la fuente después; probar esa secuencia es siguiente prioridad.

#407 sigue abierto: custodio independiente real, backup completo protegido/retención/acceso/claves, restauración aislada operacional y RPO/RTO, permisos/índices/credenciales productivos, dispositivos y compatibilidad e informe integral pendientes. No autoriza merge ni Render. No se modifican main, Empresarial, Blushéa, datos reales o planes de pago.

## Siguiente paso recuperable

Comprobar de nuevo HEAD/#389/#407 y CI. Verificar constancias históricas tras restauraciones/correcciones posteriores y resolver continuidad del legado cuando falta JWT original solo con evidencia vinculante real. Preparar exportación/recuperación local accesible sin borrar originales. Mantener gates y no desplegar lotes parciales.

## Evidencia verificada del bloque

Código `7b83f613ce2957b6db721ea757759ec8a30d0d51`, árbol `d469ece1e1ed0c1e578ea1fe9cb2ad7022d06561`. Ocho archivos exclusivamente personales, árbol local y remoto idénticos, publicación con expected_sha y sin force.

- [Gate 43195207046](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43195207046): success.
- [Seguridad 43195207081](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43195207081): success.
- [V81 43195207086](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43195207086): success, ocho jobs aprobados.
- Job autorizado 131104276014: Mongo 81/81 y navegador/backend 11/11; cero fallos, cancelaciones u omisiones. `FP_ARCHIVO_MANUAL`: fuentesReales=100, archivoBytesExactos=true, consultaCompleta=true, continuaRegistroUnico=true, sinPOSTDeArchivo=true, sinCambioFuentesPrevias=true, recarga=true, aislamiento=true, viewport=390, datos=sinteticos.
- Local: diez pruebas nuevas aprobadas; módulo 648/639/9 y CI personal 353/349/4; omisiones solo locales declaradas, cero fallos. Sintaxis y diff correctos. No se modificaron ni desactivaron gates.

El ensayo con Node 20/Chromium y Mongo aislado no acredita dispositivos físicos ni recuperación de producción. #407 y los requisitos independientes siguen pendientes. No merge ni Render. El SHA documental de cierre se identificará en el resumen del PR tras verificar su CI exacta; no existe autorreferencia del commit dentro de su propio contenido.
