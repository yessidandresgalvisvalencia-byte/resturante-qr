# Metas declaradas recuperables — V81, r90

## Alcance y aceptación
Crear y consultar metas con confirmación explícita, clave estable, fuente original y recibo propio verificable. Deben validarse casos normales, rechazos, doble envío, concurrencia, respuesta perdida, aislamiento, rollback y manipulación. La meta y su acumulado son declaraciones: no reservan efectivo, acreditan saldo bancario, generan ingresos ni habilitan gasto.

Base comprobada: PR389 abierto/sin merge, HEAD29a62c56f1d12d35782e7aeddd8f7a2c5556b374, árbol1d88785781e6a82198cfba2090f3a3d65729984e; integration/fp-hormiga-clasificacion-credito-v81 hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. CI padre Gate43376414454/Seguridad43376414457/V8143376414443 success; job131723837132 Mongo82/browser17. #407 es issue abierto con seis criterios/gate independiente vigentes.649ccda3 quedó superado.

## Comportamiento implementado
- POST /metas: cuerpo exacto nombre/objetivo/acumulado/fechaObjetivo/confirmacion=true y header Idempotency-Key meta_... Objetivo positivo y acumulado entre cero y objetivo, COP enteros seguros sin coerción/redondeo. Nombre NFKC/mayúsculas normalizado impide duplicados propios incluidos legados. Fecha civil Bogotá opcional null; nueva creación hoy/futuro, replay conserva recibo aunque venza.
- fin_metas y fin_recibos_creacion_metas_personales_v1 se insertan en transacción snapshot/majority. Secuencia única por dueño serializa altas; cuatro índices únicos de recibos se comprueban antes de escribir. No se toca cursor financiero, caja, pagos, préstamos ni outbox.
- GET /metas/confirmacion-creacion/:solicitudId consulta recibo del JWT; clave ajena no revela fuente. GET /metas?pagina=1 lista20, máximo500/25páginas, verificando cadena y fuentes. Falla cerrado ante excesos, datos inválidos, adulteración, huecos y originales/recibos faltantes.
- Resumen verifica metas/recibos en su misma sesión; solo activas integran proyección. Legado sin recibo se conserva sin certificar; objetivo0 no inventa progreso. Acumulado igual al objetivo no marca CUMPLIDA automáticamente.
- Pantalla exige confirmación, bloquea doble envío en vuelo y conserva cuerpo/clave por dueño en control con lectura de comprobación. Tras recarga consulta primero recibo; 404 no acredita falta de aplicación. Solo reenvío explícito usa cuerpo/clave originales. Respuesta tardía no limpia nueva edición ni otra sesión. Nombres como texto literal.
- Modelos y política Mongo impiden UPDATE/DELETE de fuente/recibo (24 colecciones protegidas). Es provisión comprobable en ensayo, no roles productivos ya instalados.
- RespaldoV21 agrega ambas colecciones (42); V20 exacto40 y anteriores siguen compatibles. Restauración solo en base aislada autorizada, nunca sobre producción.

## Plan y evidencia previa a publicación
1. Contrato, transacción, recibo, listado e integridad con límites.
2. Resumen e interfaz recuperable con aislamiento y conservación de entradas.
3. Pruebas puras/interfaz y suite autorizada Mongo/navegador-backend.
4. Publicar con expected_sha, force=false, árboles iguales; comprobar tres CI del SHA exacto.
5. Cierre trazable aquí, matriz y continuidad; sin habilitar gates ni Render.

Local: nuevas puras/control5/5 e interfaz4/4; compatibilidad/permisos33/33; módulo822/813aprobadas/9omisiones; ci:personal353/349aprobadas/4omisiones; cero fallos finales. Omisiones locales no acreditan servicios externos. Auditoría estática no encontró patrones de mutación revisados y mantiene bloqueo #407. SHA nuevo y pruebas autorizadas pendientes de consolidar tras publicación.

## Límites y siguiente bloque
Este bloque crea/consulta declaraciones. Aportes, corrección, retiro/restauración de metas mediante eventos siguen pendientes; requieren confirmación del dueño, idempotencia y efectos financieros definidos. La fuente queda inmutable mientras se implementan. Hash no impide reescritura coherente por administrador malicioso. Faltan custodio independiente real, backup con retención/acceso y restore operativo/RPO-RTO, roles/índices productivos, auditoría contextual IP/dispositivo, físicos/Safari y auditoría independiente cuando corresponda. Sin certificación externa ni garantías absolutas.

Siguiente: ciclo de corrección/retiro/restauración de metas por eventos preservando fuentes; no sumar metas a caja ni restarlas automáticamente de Disponible Hoy. #407 y criterios globales bloquean liberación. Sin merge, Render, costos, cambios en otros productos o datos reales.

## Validación inicial y corrección r90
Publicado con lease código059067a4fe79e58c06374d9b5214ad7e092b6622/árbolc82963685cb45502b693aea93a6c50519e257d8c. Gate43379567822 y Seguridad43379567815 success; V8143379567754 falló en job131733920392 por contrato de exceso de metas: esperaba422, recibió503. Subtest nuevo de metas pasó. Se mantiene rechazo/capacidad sin omitir originales y se restablece422; se añade regresión pura. También se evita excepción final no controlada de pantalla ante diario local dañado, con bloqueo de botón, preservación de formulario y prueba. Ningún gate se debilita; Mongo/navegador completos del descendiente quedan pendientes.
