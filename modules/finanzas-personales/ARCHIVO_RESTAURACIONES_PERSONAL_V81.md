# Archivo recuperable de restauraciones — r85

## Plan y alcance

PR389 abierto/sin fusionar, integración integration/fp-hormiga-clasificacion-credito-v81. Padre real66f87c01e691ee1f0ce67f1d56005231ebca40c5/árbol763f835b5acb26b506bd7631f34717aa731fdce5; base autorizada feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. #407 sigue abierto con sus seis requisitos; no existe nueva evidencia externa de custodia/gate independiente/configuración productiva para cerrarlo.

Un bloque funcional: continuar después de100 solicitudes de restauración de pagos, preservando originales y recibos mediante archivo explícito, consulta accesible y copia/recuperación cifrada de páginas. Incluye comprobar lectura posterior en guardar: una escritura ignorada debe detener el envío antes del POST. No cambia cálculos, rutas, fuentes MongoDB, dependencias, gates, Empresarial, Blushéa o main. El pendiente original de gastoInteligentePersonal.service.js ya consta resuelto en CONTINUIDAD_V81.md; no se reimplementa.

## Criterios de aceptación

| Criterio | Comportamiento y evidencia |
| --- | --- |
| Consentimiento explícito | Archivar1–100 solicitudes cerradas exige plan ligado a usuario, SHA256 exacto de raíz y cantidad; rechaza vacío, pendientes, plan cambiado o sesión anterior |
| Recibos verificables | CONFIRMADA y NO_APLICADA requieren recibo propio ligado a clave, cuerpo, préstamo, movimiento, anulación y resultado mediante validador existente. Ausencia, estado contradictorio o comprobante ajeno bloquea archivo |
| Escribir antes de enviar | Guardar raíz comprueba lectura exacta posterior. Cuota/escritura ignorada impide crear o cerrar solicitud; UI prueba cero POST financiero si no pudo conservarla |
| Original antes de liberar | Página byte por byte en gruk.fp.restauraciones.v81:usuario:archivo:SHA, lectura verificada antes de nueva raíz. Sin borrado de claves ni originales; reintento reutiliza huérfano idéntico, no sobrescribe conflicto |
| Capacidad acotada |100 activas +20 páginas de1–100 cerradas (máximo2100), claves únicas entre páginas, referencias ordenadas con prefijos completos. Límite explícito sin poda ni rotación automática |
| Consulta accesible | details/textContent adaptable muestran cuerpos/recibos históricos literales, sin ejecutar HTML o acreditar saldo/estado actual del pago |
| Copia compatible | FP_RESTAURACIONES_LOCAL_V1 sin páginas; V2 con originales exactos. Mismo AES-GCM/PBKDF2 y límites del transporte existente, sin alternativa débil |
| Recuperación idempotente | Valida dueño/tipo/referencias/huellas/recibos. Escribe páginas y acuse antes de activar raíz; no reemplaza otro diario o archivo. Reimportación reconoce entradas archivadas y conserva cierres y solicitudes posteriores |
| Sesión y concurrencia | Controles bloqueados durante archivo/copia/consulta; cambio de sesión o nuevas solicitudes durante verificación impide archivo. Salir limpia vista, conserva almacenamiento; pendientes activos siguen bloqueando C3 |
| Efectos financieros | Archivo, consulta y copia/recuperación del diario no restauran pagos, reenvían decisiones ni alteran caja, capital, reservas o fuentes financieras |

## Pruebas reproducibles y estado local

```bash
node --test test/finanzas-personales/archivoRestauracionesPersonal.test.js test/finanzas-personales/copiaRestauracionesPersonal.test.js test/gruk/frontend-version-aislamiento-personal.test.js test/gruk/hormiga-version-javascript-personal.test.js
node --test test/finanzas-personales/*.test.js
npm run ci:personal
# Solo CI con datos sintéticos y MongoDB autorizado aislado, nunca producción:
node --test test/finanzas-personales/browser/backend-recuperacion.browser.cjs
```

Once pruebas nuevas:100/101 y cierres confirmados/no aplicados, idempotencia con página posterior y colisión de clave archivada, pendientes/recibo ausente-ajeno-contradictorio, planes/usuario/sesión/solicitud posterior, cuota/escrituras ignoradas en página/raíz, corrupción/prefijos/duplicados y recibo ajeno aun recalculando SHA, límite20, copiaV2/V1 y reimportación tras archivar, fallos importando páginas/acuse/raíz y conflictos, carreras asíncronas, UI literal/confirmación/limpieza y escritura ignorada sin POST. Las ocho pruebas anteriores de copia se mantienen.

Local: dirigidas22/22; módulo770 pruebas/761 aprobadas/9 omisiones por servicios externos; ci:personal353/349/4; cero fallos y sintaxis aprobada. Omisiones no equivalen a validación operativa. Node24 local frente Node20 CI. git diff --check sin errores. No se atribuye ejecución local de MongoDB autorizado o navegador nativo: comprobar las tres CI del SHA exacto sin relajar gates/casos/timeouts/cuotas.

Prueba nativa ampliada en RESTAURACION y CIERRE: tras POST real con respuesta perdida, copia preserva pendiente y bloqueo C3; GET propio confirma restauración o cierre sin aplicar. Archivo explícito conserva página exacta, consulta literal y borrador visual de esa pestaña. Reimporta copia anterior sin volver pendiente, descarga copia con archivos y recupera en tercera pestaña/login HTTP200 real. FP_ARCHIVO_RESTAURACION compara raíz/páginas y snapshot de caja/capital/reservas/fuentes, cero POST/nuevos GET de recibos por archivo/copia y ancho390 sin desborde. No se da por ejecutada antes de evidencia CI. Se mantienen revocación/renovación de sesión, cuota429 real y demás aserciones anteriores.

## Evidencia previa y checkpoint

Padre66f87c01: Gate43324678365, Seguridad43324678374 y V8143324678371 success comprobados antes de actuar. La corrección de401 propio y su prueba de cambio de sesión en vuelo ya se cerraron; no se repiten. Publicar lote con árbol local/remoto idéntico y expected_sha/force=false; registrar SHA, CI y fallos si aparecen. Tarea permanece activa, sin prometer ejecución ininterrumpida.

## Límites y siguiente paso

sessionStorage no acredita durabilidad ni backup independiente. SHA local detecta discrepancias frente a referencias conservadas; no impide reescritura coherente por quien controla navegador. Recibos no son firma/certificación externa ni estado bancario vigente. Archivar no convierte una restauración anterior en autorización para repetirla; la fuente financiera original y sus eventos siguen en servidor.

Este diario conserva solicitudes enviadas y recibos, no el formulario visual todavía sin enviar. Archivar conserva ese borrador en la vista actual, pero la copia no lo incorpora ni lo recupera en otra pestaña; se identifica como pendiente específico, sin prometer protección inexistente. Próximo bloque: conservar y recuperar ese formulario por propietario, validando sesiones y cambios de vista sin crear solicitudes financieras.

Máximo8MiB de contenido portable/12MiB de archivo cifrado, raíz/página hasta1MiB recuperable. Textos/cuota pueden limitar antes de2100; se rechaza exceso sin recortar. Sin autoarchivo ni borrado al salir; frase perdida no recuperable. Copia descargada no sustituye backup independiente MongoDB, retención/acceso/credenciales separadas ni restauración operacional aislada/RPO-RTO. Dispositivos físicos y rendimiento máximo pendientes.

#407/custodio independiente real/backups y restauración operacional/roles e índices Mongo productivos/auditoría-dispositivos-compatibilidad siguen pendientes. Mantener sin merge a feature ni Render, costos nuevos, otros productos o alteraciones de datos reales.
