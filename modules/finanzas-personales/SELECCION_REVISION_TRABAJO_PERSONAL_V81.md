# Selección confirmada de revisión de trabajo — r107

19 de noviembre de 2026 (Colombia). Padre real `2bcdd07770a8494b2da7d67465c88a90ed6d6926`, árbol `afdb888a86344501c0a876577174673e9dabd531`; PR389 abierto/no integrado, rama integration/fp-hormiga-clasificacion-credito-v81 hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. #407 es issue abierto. Padre: Gate44596012639/Seguridad44596012644/V8144596012641 success, Mongo99/99 y Chromium/backend32/32 sin omisiones. Instrucciones revisadas: sin AGENTS.md adicional; solo módulo personal, sin producción ni gates debilitados. Gasto inteligente/fechas y r106 ya cerrados, no se cuentan otra vez.

## Bloque y criterios

Un bloque: previsualización de selección y confirmación de esa versión en revisión de cobros. El recibo global duradero es otro bloque pendiente; no se declara implementado por devolver un hash.

- GET /reconciliar-ingresos-trabajo/previsualizacion: snapshot de solo lectura, dueño JWT, sin filtros aceptados, no-store. Hasta500 cuentas por cobrar ya pagadas (mismo alcance anterior), lista propia con contraparte/concepto/ID, reclasificaciones previstas y pendientes manuales. Conserva originales/eventos/caja/outbox/cursor. No infiere trabajo del concepto o campo legacy.
- Huella SHA256 canónica REVISION_TRABAJO_V1 vinculada al usuario, originales crudos sin defaults, cobros efectivos y hashes de compensación, evidencia explícita de origen y resumen. No almacena la previsualización ni promete que una selección anterior siga vigente. No es firma, ancla independiente, recibo persistente ni prueba de consentimiento histórico.
- POST requiere cuerpo exacto confirmacion:true + versionSeleccion64hex. El servicio interno también exige ese contrato. Recalcula dentro de la transacción y rechaza409 si varía la selección, los originales, evidencia o cobros. La coordinación financiera existente antes de compensar mantiene reintentos de snapshot con nueva comparación; fallo persistente revierte todo. No-op no adelanta cursor. Devuelve versión aplicada para cotejo, no recibo recuperable.
- Interfaz carga primero la vista, enumera todas las cuentas/resultados esperados en confirmación, permite cancelar sin POST y confirma la versión vista. Bloquea dobles clics y descarta respuestas de otra sesión. No aplica una selección reemplazada silenciosamente. Respuesta incompleta/incoherente mantiene incertidumbre; no reintenta automáticamente ni afirma recuperación.
- Validación: canon/BSON/fecha/usuario/importe/hash/evidencia/cuentas nuevas; Mongo real con rol restringido, vista repetible sin cambios, JWT ajeno/filtros/contrato forjado, origen confirmado tras vista obsoleta, rollback, carrera de misma selección una aplicación y409, repetición antigua409, nueva vista sin cambios; Chromium390 con GET antes dePOST y versión enviada, caja y fuentes intactas.

## Compatibilidad y límites

El POST anterior con solo confirmacion ahora400: cliente/cache/tests deben publicarse juntos. No se añade colección, índice ni cambio de formato de backupV31/44. Selección efímera de snapshot acotado, no almacenada ni recuperable entre solicitudes. Si se pierde respuesta después del commit, repetir la versión vieja puede responder409; no prueba por sí solo si esa solicitud se aplicó. Próximo bloque: recibo global append-only, clave estable, consulta por dueño y recuperación/cierre de incertidumbre con auditoría, índices/roles/backup y fallos/concurrencia correspondientes. Después diagnóstico/adopción legacy y otros conceptos; contexto deuda/crédito/metas ambiguas.

#407 sigue bloqueando producción: custodio independiente real/anclas, backup durable/retención/acceso/claves y restauración operativa aislada/RPO-RTO, roles/índices/migración/configuración reales, Safari/dispositivos y auditoría independiente/compatibilidad/informe final según matriz. Sin garantías absolutas, merge, Render, datos reales, costos o servicios nuevos. main/Empresarial/Blushéa intactos. Tarea activa.

## Evidencia

Implementación y pruebas nuevas en preparación; no contar cierre sin CI del SHA exacto. Publicación mediante comparación HEAD/expected_sha/force:false, árbol local cotejado. Cierre y siguiente paso se conservarán aquí y en continuidad; el SHA propio del cierre se verifica por Git/PR para evitar autoreferencia circular.

Validación local previa: módulo920 casos/911 pass/9 omisiones externas/0 fallos; ci:personal353/349 pass/4 omisiones/0 fallos. Sintaxis de cliente/browser y diff correctos. Se extiende el caso Mongo autorizado y el mismo caso Chromium390 (previsualización, cancelar sin POST y posterior confirmación versionada), sin aumentar número ni timeout de navegador. Mongo real/CI del SHA nuevo pendientes.
