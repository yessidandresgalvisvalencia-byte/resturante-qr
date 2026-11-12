# Archivo recuperable de imputaciones — r84

## Plan y alcance

PR389 abierto/sin fusionar, integración integration/fp-hormiga-clasificacion-credito-v81. Padre real8b7f7267ac7bfbc0335c7eb6796c36aebfdf5f85/árbol8fa1cae4345e9d296e23186ca09dffd633dbf2d2. Base autorizada feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. #407 sigue abierto y conserva sus seis requisitos; este cambio local no acredita custodia, permisos productivos ni gate independiente.

Un bloque funcional: continuar después de100 solicitudes de imputación conservando originales, formularios y recibos; consulta accesible y copia/recuperación cifrada de páginas. Incluye corregir guardar sin comprobación de lectura posterior: una escritura ignorada debía fallar antes del POST, no tratarse como solicitud conservada. No cambia cálculos, rutas, fuentes MongoDB, dependencias, gates, Empresarial, Blushéa ni main. El pendiente inicial de gastoInteligentePersonal.service.js ya consta resuelto en CONTINUIDAD_V81.md; no se repite.

## Criterios de aceptación

| Criterio | Implementación / comprobación |
| --- | --- |
| Archivo explícito |1–100 solicitudes cerradas, plan ligado a usuario, SHA256 exacto de raíz y cantidad; exige confirmación y sesión vigente, rechaza vacío/pendiente/plan cambiado |
| Recibos propios | CONFIRMADA y NO_APLICADA requieren recibo ligado a clave, dueño, préstamo, cuerpo y resultado por validador existente. Estado contradictorio, recibo ausente o alterado bloquea archivo |
| Guardar antes de enviar | Todas las escrituras de raíz comprueban lectura exacta posterior; error/cuota/escritura ignorada impide continuar. UI prueba cero POST cuando no se conserva formulario |
| Original antes de liberar | Guarda página exacta en gruk.fp.imputaciones.v81:usuario:archivo:SHA y verifica lectura antes de nueva raíz con referencias/lista vacía. Mantiene formulario; no borra claves |
| Fallo parcial recuperable | Reutiliza página huérfana idéntica en reintento; conflicto no se sobrescribe. Fallo en página o raíz conserva lista original |
| Capacidad acotada |100 activas +20 páginas de1–100 cerradas, máximo2100. Claves únicas entre páginas, referencias con prefijos completos, sin poda o rotación automática |
| Consulta accesible | details y textContent adaptable muestran cuerpos/recibos históricos literales. No ejecuta HTML ni presenta decisión histórica como vigente o autorización de gasto |
| Copia compatible | FP_IMPUTACIONES_LOCAL_V1 sin páginas; V2 con originales exactos. Mismo transporte AES-GCM/PBKDF2, límites y frase privada existentes; no debilita cifrado |
| Recuperación idempotente | Verifica tipo, dueño, referencias, huellas y recibos; páginas/acuse antes de activar raíz. No reemplaza diarios/archivos conflictivos. Reimportación busca también entradas archivadas, conserva estados y formularios posteriores |
| Sesión y fallos | Bloquea controles durante archivo/copia/consulta; cambios de sesión/formulario durante verificación impiden archivo. Salir limpia vista, conserva almacenamiento. Pendientes activos mantienen bloqueo C3 |
| Finanzas sin repetición | Archivo/consulta/copia/recuperación no reenvían decisiones ni cambian caja, capital, reservas o fuentes de pago |

## Pruebas y ejecución

```bash
node --test test/finanzas-personales/archivoImputacionesPersonal.test.js test/finanzas-personales/copiaImputacionesPersonal.test.js test/gruk/frontend-version-aislamiento-personal.test.js test/gruk/hormiga-version-javascript-personal.test.js
node --test test/finanzas-personales/*.test.js
npm run ci:personal
# Solo CI con datos sintéticos y MongoDB autorizado aislado, nunca producción:
node --test test/finanzas-personales/browser/backend-recuperacion.browser.cjs
```

Once pruebas nuevas:100/101, cierre aplicado/no aplicado, formulario intacto, idempotencia con página posterior y colisión de clave archivada, pendientes/recibo ausente-ajeno-contradictorio, plan/usuario/sesión/formulario, cuota y escrituras ignoradas en archivo/raíz, corrupción/duplicados/prefijos, límite20, V2/V1 y reimportación después de archivar, fallos importando página/acuse/raíz y conflictos, carreras asíncronas, UI literal/confirmación/limpieza y escritura ignorada sin POST. Las diez pruebas de copia anteriores se mantienen.

Local: dirigidas24/24; módulo753 pruebas/744 aprobadas/9 omisiones por servicios externos; ci:personal353/349/4; cero fallos en estas suites y sintaxis completa aprobada. Node24 local frente Node20 CI. Omisiones no equivalen a validación operativa. git diff --check sin errores. No se afirma ejecutar localmente MongoDB autorizado o navegador nativo; comprobar CI exacta del SHA publicado sin relajar gates, casos, timeouts o cuotas.

Prueba nativa ampliada para ambos resultados reales (APLICADA y NO_APLICADA): POST original pierde respuesta, copia preserva pendiente y bloquea C3, GET propio confirma resultado; archivo explícito preserva página/formulario exactos y reimportación anterior no vuelve pendiente. Descarga copia con archivos y recupera en tercera pestaña/login HTTP real; consulta literal y ancho390 sin desborde. FP_ARCHIVO_IMPUTACION compara snapshot de caja/capital/reservas y fuentes de pago, con cero POST o nuevos GET de recibos por archivo/copia. Pendiente de ejecución CI; no se da por aprobado antes de evidencia.

## Evidencia previa y checkpoint

Padre8b7f7267: Gate43315171065, Seguridad43315171125 y V8143315171187 success comprobados antes de actuar. Se revisó #407 abierto y su alcance personal; no existe nueva evidencia externa para cerrarlo. Calendario/capturas ya completados no se reimplementan. Publicar con árbol local/remoto idéntico y expected_sha/force=false; registrar SHA, CI y diagnóstico de fallos si aparecen.

## Límites y siguiente paso

sessionStorage no es durabilidad ni backup independiente. SHA local detecta discrepancias con referencias conservadas; no impide reescritura coherente por quien controla navegador. Recibos locales no son firma externa ni certificación bancaria; muestran una decisión original, no su vigencia posterior. Los pendientes activos conservan consulta autenticada de recibo y reenvío explícito con misma clave. Archivar no restaura pagos ni modifica su contexto actual.

Máximo8MiB de contenido portable/12MiB de archivo cifrado, raíz/página hasta1MiB recuperable. Cuota o textos grandes pueden limitar antes de2100; se rechaza sin recortar. Sin autoarchivo, limpieza o borrado al salir. Frase perdida no recuperable; copia descargada no sustituye respaldo independiente de MongoDB ni restauración aislada/RPO-RTO. Dispositivos físicos y rendimiento máximo pendientes.

Siguiente: capacidad recuperable del diario de restauraciones de pagos y comprobación de fallos de almacenamiento, sin poda. #407, custodio independiente real, backups protegidos/retención/acceso/credenciales separadas y restauración operacional aislada/RPO-RTO, roles e índices Mongo productivos, auditoría/dispositivos/compatibilidad siguen pendientes. Mantener tarea activa; sin merge a feature ni Render, costos nuevos o alteraciones de datos reales. No se promete ejecución ininterrumpida.
