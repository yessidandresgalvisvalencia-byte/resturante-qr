# Recuperación: navegador → HTTP → Mongo autorizado — r66

Revisión 2026-11-11. PR #389 abierto, base feature/finanzas-personales SHA 652126a03f19fbec3c529cad1e84bff11cd3699e; integración integration/fp-hormiga-clasificacion-credito-v81. Padre real 174f48216a105431a7ede62c67eb2627e93507d5, árbol b16a48f47747aac6f5cee8ad697f93aed1f56f20. CI padre Gate 43131487716, Seguridad 43131487766 y V81 43131487760 verdes. #407 continúa abierto.

## Plan y criterios de aceptación

Un bloque de integración completo: recorrer recuperación positiva y cierre NO_APLICADA desde el HTML real a rutas, autenticación, servicios y MongoDB reales de ensayo. La suite sintética de navegador anterior se conserva; no se sustituye por esta prueba ni se retiran gates.

| Criterio | Verificación implementada |
| --- | --- |
| Destino aislado obligatorio | NODE_ENV=test y únicamente mongodb://127.0.0.1:27018/gruk_v81_test_browser_personal, sin credenciales ni parámetros en URI; otro destino falla antes de conectar, sin skip |
| Privilegios y credenciales | Provisionamiento administrativo separado; conexión Mongoose de aplicación con usuario/clave efímeros y 21 historiales INSERT-only; auditoría de privilegios e índices relevantes antes de servir HTTP |
| Backend real | buildApp de servidor personal, router y middlewares reales; Socket.IO/realtime reales; sin stubs de JWT, servicios, transacciones, respuestas ni recibos financieros |
| Autenticación | Registro real vía HTTP, login desde HTML, JWT HS256 y consulta de identidad reales; 401 sin JWT/inválido y tras revocar tokenVersion; nuevo login recupera acceso |
| Recuperación | Fuente firmada de ensayo, pago/anulación/cambio de fecha mediante servicios reales; historial y selección mediante UI; confirmación y doble clic; una restauración con caja/capital 900 desde 1000, sin duplicar fuente |
| Respuesta perdida | Playwright reenvía la petición al backend, espera ok después del commit y descarta únicamente su respuesta; conserva solicitud, recarga y consulta recibo real por GET |
| Cierre | Calendario se retira mediante corrección auditada; POST normal rechazado conserva estado; cierre explícito y respuesta perdida después del commit; NO_APLICADA con fuente/caja/capital/eventos financieros intactos |
| Idempotencia y preservación | Igualdad completa de foto financiera tras GET/replay; mismo cuerpo y clave; fuente original idéntica; compensación y Outbox únicos para restauración, ninguno nuevo por cierre |
| Aislamiento | Usuario ajeno obtiene 404 de preview/recibo; logout/login reales no muestran diario de otro usuario ni borran solicitud original; revocación y nuevo JWT no duplican efectos |
| Red y caché | Solo origen HTTP loopback; origen externo bloqueado y hace fallar el caso; recibos privados no-store; datos exclusivamente sintéticos |

## Alcance exacto

El harness usa la factory de producción, escucha solo 127.0.0.1 en puerto asignado y no invoca start() ni sus trabajos macro/outbox/recordatorios externos. No cambia configuración ni código de producción para realizar el ensayo. /healthz sigue devolviendo 503 en la factory: el test lo exige para no presentar como aprobados los gates de arranque completos. El rate limiter es el comportamiento local permitido en NODE_ENV=test; no prueba Redis distribuido de producción. La CI nativa de Redis y de arranque/roles permanece independiente y obligatoria.

Datos semilla y correcciones se crean únicamente en la base exclusiva del contenedor autorizado existente de CI. No se borra/restaura información de usuarios ni se conectan credenciales reales. No se despliega ni se modifica main/Empresarial/Blushéa. No hay nuevos servicios o planes de pago.

## Estado de validación y límites

Local: módulo 614 casos, 605 aprobados, 9 omitidos por requisitos de integración; CI personal 338/334/4, cero fallos. Guardia de destino y contratos CI: 16/16; sintaxis del harness y diff --check comprobados. La ejecución E2E requiere Mongo autorizado y Chromium en runner CI; no se declara aprobada antes de observar el SHA exacto. Se añade al job mongo-privileges-v81 después de la suite de privilegios, antes de la limpieza del contenedor aislado. Falta de dependencia, destino o navegador hace fallar el ensayo; no hay omisión silenciosa.

Aun si este ensayo pasa, quedan pendientes custodia/revisión independiente real, roles/índices y separación de credenciales observados en producción, copia independiente con retención/protección/acceso, restauración operacional aislada con RPO/RTO, compatibilidad de despliegue y dispositivos físicos/Safari. #407 y liberación siguen bloqueados hasta evidencia real. No afirmar certificación externa, ausencia absoluta de vulnerabilidades ni recuperación garantizada.

Siguiente: contrastar matriz de aceptación con el recorrido observado; priorizar fallos reales de interfaz/contratos y completar los flujos de recuperación restantes sin duplicar trabajo. Conservar SHA, resultados y límites tras CI.


## Cierre funcional verificado r66
SHA de código a4eb790e8ae1f33dad10304e66dd99757be34a6c; árbol 4c101066b8bcbacccb30ed78c12cbae67fa6d95c. Gate 43136830278, Seguridad 43136830282 y V81 43136830240 satisfactorios para ese SHA. Job autorizado 130914080354: suite nativa 81/81 y ensayo browser/backend 3/3 (padre y recorridos RESTAURACION/CIERRE), cero fallos/omisiones. Chromium 151.0.7922.34; 21 historiales protegidos, usuario administrativo separado del de aplicación, datos sintéticos. Browser sintético previo job 130914080342 también aprobado (5/5). No se sustituyeron servicios, autenticación ni recibos en el ensayo backend; solo se descartó la respuesta HTTP después del commit real.
Se observaron registro/login HTTP, JWT real y 401 tras revocación de tokenVersion, acceso con JWT nuevo, 404 ajeno, no-store, preservación de fuente, caja/capital exactos, un efecto por clave y recibo GET/replay sin escrituras. Logout/login conservaron el diario del propietario sin mostrarlo al otro usuario. La guardia rechazó destinos no autorizados antes de conectar. No se observaron errores JS en los recorridos.
Local: módulo 614/605/9, CI personal 338/334/4; destino y contratos 16/16; sintaxis y diff --check satisfactorios. Backup V19 de la suite nativa: 39 colecciones, 5594 documentos, 3882946 bytes, captura 229 ms, restauración 1093 ms y edad 1257 ms; custodiaIndependiente=false y rpoProduccion=false. No son métricas de recuperación operativa real.
El commit descendiente solo registra esta evidencia y también requiere CI exacta verde. Alcance de arranque: factory/router/realtime reales con healthz 503 conservado; no se ejecutaron start(), tareas auxiliares externas ni Redis de producción. No constituye aprobación de arranque o despliegue productivo, dispositivos físicos ni custodia independiente.
Siguiente paso recuperable: comprobar expiración y revocación en sockets ya conectados. Este lote verifica HTTP y cambio de sesión/reconexión; no prueba que un socket abierto antes de revocar el JWT deje de recibir eventos. Diseñar prueba de aislamiento antes de cambiar comportamiento. #407/custodia/operación/dispositivos permanecen pendientes. Sin merge a feature ni Render; main, Empresarial, Blushéa y datos reales sin cambios; sin servicios/planes nuevos.
