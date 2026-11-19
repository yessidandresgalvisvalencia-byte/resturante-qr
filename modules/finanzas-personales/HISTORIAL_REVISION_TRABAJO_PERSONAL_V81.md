# Historial propio de recibos de revisión — r109

19 de noviembre de2026 (Colombia). Padre reale9b6d61274b697dc8c7d07128de4137111979cd9/árbol5b0d8c94b0e48ed4ae29998c82e57b320e639084; PR389 abierto/no integrado hacia feature652126a03f19fbec3c529cad1e84bff11cd3699e, rama integration/fp-hormiga-clasificacion-credito-v81. Issue407 abierto y sin actualización de evidencia externa. Padre Gate44605389675/Seguridad44605389849/V8144605389808 success, ocho jobs, Mongo100/100 y Chromium/backend32/32 sin omisiones. Instrucciones personales/continuidad revisadas, sin AGENTS.md adicional. Gasto inteligente/fechas, selección y recibo r108 ya cerrados: no repetir como bloques nuevos.

## Bloque y plan

Un bloque completo: historial propio paginado con acceso a verificación individual desde interfaz. Resuelve la búsqueda de recibos cuya clave ya no está disponible en el navegador. La exportación/importación portable del diario queda como siguiente bloque; no se cuenta como completada.

- GET /reconciliar-ingresos-trabajo/recibos acepta únicamente cursor opcional24hex minúsculas; dueño JWT, no-store y sin datos del usuario por cuerpo/filtro. Página20+1, orden_id descendente, cursor sobre último recibo mostrado. Cursor debe existir para ese dueño; ajeno/ausente404, inválido/duplicado/filtros extra400. No se inventan totales ni un snapshot congelado de todas las páginas ante nuevas inserciones.
- Índice no único nuevo(usuarioId1,_id1), nombre fp_revision_trabajo_historial_v1, permite recorrido inverso con dueño fijo. Se exige definición exacta sin sparse/TTL/colación incompatible; faltante503 para historial. Índice único de idempotencia se mantiene. Provisión solo administrativa y no destructiva, nunca desde HTTP. Colección/roles protegidos26 y backupV32/45 no cambian; copias previas sin el índice necesitan provisión administrativa antes de ofrecer este historial, no se descartan.
- Cada recibo de la página verifica estructura/hash/propietario. Salida estricta:solicitudId/fecha/estado/corregidos/requierenRevisionManual/hash/verificacionFuentesPendiente. No expone selección cruda, fuentes, compensaciones ni contexto privado. Un recibo adulterado en la página rechaza toda esa página409, sin omitirlo para simular completitud. La lista es resumen histórico: no certifica fuentes actuales ni resuelve pendientes por sí sola.
- El botón Verificar recibo usa la consulta existente que comprueba hash, originales y cadena. El recibo consultado debe coincidir con resumen/propietario/resultado/hash y límites declarados. Puede cerrar solamente el pendiente local correspondiente con el mismo cuerpo/clave conservados; no crea solicitud ni reenvía una revisión. Sin pendiente local es lectura histórica. Sin recibo verificable conserva incertidumbre.
- Interfaz visible en Deudas/Cuentas por cobrar, con consultar/anterior/siguiente y estado accesible. Renderiza texto con textContent, sin HTML financiero interpolado; ajuste de línea para hashes. No usa saldo actual como prueba de una operación anterior. Cambio de sesión, limpieza o respuesta tardía no muestra datos de otra identidad ni confirma pendientes. Error de red o página incompleta no muestra resultados parciales como verificados. Sin pagos, compensaciones o modificaciones de caja desde el historial.

## Aceptación y pruebas

| Criterio | Evidencia requerida |
| --- | --- |
| Paginación/privacidad | Mongo autorizado crea23 recibos propios y1 ajeno; páginas20+3 sin duplicación, cursor final/vacío/repetición, salida exacta sin privados |
| Seguridad | JWT dueño, cursor ajeno/inexistente404, cursor/consulta malformados400, índice retirado solo en ensayo503 y reposición administrativa exacta |
| Preservación | Listar/verificar no modifica originales/recibos/cursor/caja; adulteración de recibo en página409, reposición completa BSON del fixture recupera200 |
| Interfaz | Página/siguiente/anterior, resumen separado de verificación, errores/red/recibo cruzado; respuesta tardía al cambiar sesión no dibuja datos ni confirma |
| Navegador real | Chromium390 login/HTML/API, historial visible, consulta individual sin otro POST de revisión, recibos/finanzas exactos, login ajeno no ve recibo anterior |
| Operación | Sin colección/formato de backup nuevos; índice capturado/restaurado en ensayo V32/45; CI verde del SHA exacto con trazabilidad y lease |

## Límites y siguiente paso

No es prueba externa de trabajo/ingreso, saldo bancario actual o custodia independiente. La lista acredita solo integridad del recibo almacenado dentro de esa página; fuentes/cadena se verifican al consultar individualmente. Nuevos recibos pueden cambiar la primera página entre solicitudes; orden_id/cursor evita repetir filas anteriores al avanzar pero no ofrece exportación consistente de todo el historial ni acredita ausencia de borrado por administrador. Hash/rol de aplicación no reemplazan custodio real.

Diario de revisión todavía en sessionStorage por propietario: exportación/importación cifrada y preservación ante pérdida de almacenamiento siguen pendientes. Historial permite encontrar recibos ya persistidos, no recuperar solicitudes que nunca llegaron al servidor ni convertir404 en certeza de no ejecución. Próximo bloque: diario portable propio, validación estricta, rechazo de mezcla entre usuarios y no sobrescribir originales/pendientes, con recuperación vinculada al recibo. Después diagnóstico/adopción de orígenes legacy/otros conceptos, contexto deuda/crédito/metas ambiguas.

#407 sigue abierto: custodio independiente/anclas, respaldo durable/retención/accesos/claves separados y restauración operativa/RPO-RTO, roles/índices/migración/configuración reales, Safari/dispositivos, auditoría independiente según matriz, compatibilidad/informe final. Sin merge/Render/main/Empresarial/Blushéa, costos/servicios nuevos o datos reales alterados. Tarea activa.

## Validación previa

Local:módulo926 casos/917pass/9 omisiones externas/0fallos; ci:personal353/349pass/4omisiones/0fallos; caché/integración6/6 solapadas, sintaxis browser y diff correctos. Nuevo escenario completo Mongo autorizado y extensión del mismo caso nativo sin ampliar timeout/número artificial. CI del SHA nuevo pendiente, no declarar cierre hasta completarla. SHA propio del cierre por Git/PR sin autoreferencia circular.


### r109 — primer CI y aislamiento de identidad del fixture de navegador

SHA02518d133eaeb60ca877b0f16a0efeefb2ccc477/árbol52b2a6ddc415d6971741d3d78686f1077d5a9b53. Integración Mongo general y Mongo autorizado101/101 aprobaron sin omisiones. V8144612919946/job135873925526 falló solo navegador:32casos/30pass/2fail (uno es el padre),0omisiones. El caso nuevo sí consultó el historial y verificó individualmente el recibo con originales/caja intactos; agotó30s esperando la pestaña tras intentar entrar con el usuario global otro.

La prueba anterior CALENDARIO_HTTP_INCIERTO comprueba explícitamente429 para ese usuario compartido con cuota de login agotada. El nuevo cambio de usuario reutilizaba esa identidad, por lo que el límite de seguridad impedía el login, correctamente. Se prepara otra identidad sintética real para este escenario y se exige respuesta200 del login antes de esperar la pestaña. Se conserva la aserción429 anterior, el rate limit y todos los límites/guards; no se amplían timeouts. No hay cambios de producto en esta corrección del fixture. Nueva CI pendiente; no declarar cierre hasta completar navegador del SHA final.
