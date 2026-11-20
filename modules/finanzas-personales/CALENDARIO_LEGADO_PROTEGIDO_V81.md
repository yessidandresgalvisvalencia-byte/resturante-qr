# Protección de originales del calendario legado — V81

Fecha: 2026-11-05 (Colombia). Padre remoto verificado: `92ed3dd59c5832572d0a6a18486ccc24a6f6cc88`, PR #389 abierto, base feature/finanzas-personales. Árbol reconstruido localmente contra ese SHA: `85e5751133c3ecd5802e6192976d9bcca7546e4e`. Las tres CI del padre estaban verdes. El entorno de ejecución volvió a estar disponible; no se usan resultados locales antiguos como prueba de este lote.

## Problema y comportamiento

Antes de habilitar adopción de registros anteriores, `fin_calendario_financiero` debe conservar sus originales. El modelo permitía UPDATE/DELETE y la colección quedaba en el grupo mutable del rol de pruebas de aplicación. Ahora se incluye entre las veinte colecciones protegidas por la política de privilegios. Solo find/insert/listIndexes y lecturas admitidas: permisos adicionales de mutación, borrado, DDL o escalada hacen incompatible el rol y bloquean el arranque mediante la comprobación existente. No se otorga ningún permiso automáticamente.

El modelo rechaza updateOne/updateMany/replaceOne/findOneAndUpdate/findOneAndReplace/deleteOne/deleteMany/findOneAndDelete/bulkWrite y save/deleteOne de documentos existentes con CALENDARIO_LEGADO_APPEND_ONLY. Las fuentes nuevas siguen admitiendo INSERT; no se transforma ninguna fuente existente. La auditoría estática cubre alias, requires y accesos nativos por nombre de colección. Sus patrones no son una certificación de todas las escrituras posibles.

La restricción cubre INGRESO, GASTO_FIJO y OBLIGACION dentro del módulo personal. No cambia importes, fechas, estado activo, índices, esquema de datos, formato de backup, caja o planificación. La interfaz legada sigue de consulta; no ofrece desactivar, eliminar o adoptar todavía. Los calendarios gestionados por eventos conservan corrección/retiro/restauración existentes.

## Matriz de aceptación y evidencia

| Caso | Validación |
| --- | --- |
| Fuente nueva válida | Validación del modelo e inserción real por el rol restringido |
| Vías de mutación Mongoose | Pruebas de modelo sin Mongo; código 409 incluso para filtro vacío, documento y alias por ID |
| Permiso antiguo de calendario | Evaluador rechaza update/remove/dropCollection/dropIndex sobre esta colección aunque las demás estén restringidas |
| Driver nativo con autorización | Nuevo helper conectado al job Mongo autorizado: ocho variantes de mutación rechazadas con código 13; también lo comprueba el bucle general de veinte colecciones |
| Concurrencia y atomicidad | Doce modificaciones nativas concurrentes rechazadas; incremento de cuenta seguido de modificación de calendario falla en transacción y revierte íntegro |
| Conservación | Comparación de original BSON, cuenta, transacciones, outbox y eventos antes/después; Home conserva resultado y monto previsto |
| Consulta y aislamiento | Listado mantiene original propio de solo lectura, no adopta automáticamente y excluye fuente ajena |
| Snapshot y fallos contables previos | Se conservan las regresiones de Home, horizonte, proyección y compras; alteraciones artificiales del calendario pasan por la conexión administrativa del fixture aislado, nunca por el rol de aplicación |
| Backup | Sigue V18, 38 colecciones; calendario legado ya estaba incluido. No cambia formato ni se omiten datos anteriores |

Archivos de prueba: calendarioLegadoProtegido.test.js; helpers/calendarioLegadoProtegidoAutorizado.js conectado a privilegiosLedgerMongoV81.integration.test.js; ledger-personal-db-privileges.test.js; ledger-personal-mutabilidad-auditoria.test.js; regresiones de backup.

Local: Node 24.22.1; 491 casos del módulo, 482 aprobados/nueve omitidos/cero fallos. Otros 36 dirigidos de privilegios/auditoría/respaldo aprobados. Sintaxis general y diff sin errores. La CI usa Node 20 y debe completar pruebas de MongoDB autorizado del SHA publicado antes de contar el bloque verificado. No se afirma haber ejecutado Mongo local ni pruebas visuales. Los SHA/runs finales se registrarán al verificarlos; el SHA de este documento se obtiene del historial Git.

## Compatibilidad operativa y límites

No se ejecuta administración ni migración productiva. Un rol antiguo que permita actualizar/borrar esta colección no cumple la nueva política y el servidor debe rechazar su arranque. Antes del eventual despliegue final, se requiere revisar los privilegios efectivos, retirar concesiones incompatibles por el administrador autorizado y comprobar lectura/inserción/rechazos/índices sin alterar originales reales. No usar readWrite ni desactivar el gate para arrancar. La herramienta administrativa de índices no cambia usuarios o roles.

Un administrador con otras credenciales aún puede alterar la base; no se garantiza recuperación ni se declara evidencia externa. Las alteraciones administrativas de los fixtures prueban snapshots/fallos, no legitiman reparación o reescritura productiva. La inserción por sí sola no evita duplicación semántica: la futura adopción necesita identidad y eventos idempotentes específicos.

## Siguiente paso y liberación

Un bloque funcional de protección de originales; no contar commits documentales como otro bloque. Retomar la adopción explícita prevista en CHECKPOINT_ENTORNO_V81.md: copia íntegra/huella/identidad del original, confirmación del propietario, una sola planificación incluso tras retiro/restauración, recibos recuperables y pruebas concurrentes. No habilitar un formulario de adopción antes de completar servicio y contrato de lectura.

#407 continúa abierto. Custodia independiente real, backup durable completo/retención/accesos/claves separados, recuperación aislada operativa y RPO/RTO productivos, roles/índices/históricos reales, revisión de seguridad/compatibilidad, interfaz/dispositivos e informe final siguen pendientes. Demora y fecha de la interfaz requieren medición real. Sin integración a feature, main/Empresarial/Blushéa, Render, costos nuevos ni escritura/borrado/restauración de datos reales.

## Verificación del núcleo publicado

Núcleo `7edf96328ed62ba76a0cccbee2fc1f81e9caf49c`, árbol `98ad4f902050331ede7f8cfef0e550a74dd49726`: tres CI exactas success, Gate 42079080643, Seguridad 42079080633 y V81 42079080636. Job autenticado 127427034963: 67 pruebas/67 aprobadas/cero fallos; el subtest de originales legados aprobó. Los quince blobs remotos coinciden con los archivos publicados y el árbol coincide con la copia probada.

Ensayo backup V18 del mismo job: 38 colecciones/5342 documentos/3468690 bytes, captura 140 ms, restauración 878 ms, edad del respaldo 1007 ms. Conservación/restauración en base aislada, custodiaIndependiente=false y rpoProduccion=false. No sustituye evidencia durable, custodio real o recuperación de producción. Un bloque funcional de protección de originales verificado; el cierre documental descendiente requiere su propia CI y no se cuenta como bloque adicional. Continúa adopción explícita; #407 y todos los gates externos permanecen abiertos, sin merge ni Render.
