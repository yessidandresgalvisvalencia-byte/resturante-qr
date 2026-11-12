# Autorización de sockets personales abiertos — r67

Revisión 2026-11-11. Padre real 6e71b9fac3332d1c8a04638b38832778825be29a; árbol 13b354623f491e5073492f1d363a6b8f015b52df. PR #389 abierto sobre feature/finanzas-personales (base 652126a03f19fbec3c529cad1e84bff11cd3699e), integración personal. CI del padre Gate 43137243883, Seguridad 43137243896 y V81 43137244041 satisfactorios. #407 sigue abierto.

## Hallazgo reproducido

personalRealtime.js verificaba JWT/identidad/suscripción solo al conectar y luego emitía a la sala del usuario. La prueba controlada de socket abierto, seguida de revocación y aviso, falló antes de corregir: una entrega observada frente a cero esperadas (1 !== 0). La sala no sustituye autorización vigente. No se usaron datos reales ni se atribuye el hallazgo a una intrusión observada.

## Bloque funcional y aceptación

- Cada aviso se envía directamente solo a destinatarios locales del propietario que hayan vuelto a superar verifyPersonalToken y consulta de suscripción vigente. La validación real revisa firma/expiración/issuer/audience/scope/estado/tokenVersion del JWT y la identidad. Fallo de consulta, revocación, bloqueo o suscripción no admitida impide payload y desconecta el namespace personal.
- El token y su identidad inicial quedan en WeakMap privado; cambiar handshake/auth después de conectar no cambia la autorización capturada. Comprobación por token compartida únicamente dentro del mismo aviso, sin caché de permisos entre eventos. Índice por propietario evita recorrer sockets de todos los usuarios en cada aviso. No se cambia la política histórica de suscripción de Socket.IO.
- JWT con vencimiento inválido/ausente no conecta. Timer cierra conexiones ociosas al vencer, con intervalos limitados a 2147483647 ms para evitar overflow en JWT persistentes. Tras awaits se verifica que la conexión, sesión y vencimiento sigan vigentes antes de emitir.
- Desconecta solo el namespace personal, no otros namespaces del transporte. Limpia timers y listeners al desconectar/cerrar servidor; no deja mensajes de error con tokens, datos personales o detalles de Mongo.
- Conserva el consumidor idempotente de avisos y el eventId. No escribe saldos, capital, pagos, fuentes, compensaciones ni historial financiero. Los avisos Socket.IO no son el ledger: el cliente debe consultar el API autenticado para estado y recuperación.
- Nuevo ensayo local de autorización y fallo; integración real en el harness Chromium/HTTP/Mongo autorizado existente, sin stub de JWT, Socket.IO o Mongo. Ambos disparadores V81 incluyen realtime/** para que este código no eluda la CI.

## Matriz de pruebas

| Caso | Evidencia requerida |
| --- | --- |
| Aviso válido | Solo propietario; dos sockets con mismo JWT comparten una consulta por aviso, eventId repetido no duplica |
| Revocación con socket abierto | Tras incrementar tokenVersion y emitir, socket previo se desconecta sin recibir payload; JWT viejo no reconecta |
| Nuevo login | JWT nuevo conecta y recibe; socket viejo y otro propietario no reciben su aviso |
| Vencimiento ocioso | JWT firmado de vida corta conecta, recibe antes de expirar y se desconecta sin aviso posterior |
| Suscripción vencida | Socket abierto deja de recibir y se desconecta; se mantiene otro usuario válido |
| Consulta fallida y carrera de reloj | Fallan cerrado sin payload; vencimiento durante await no admite una última emisión |
| Ciclo de vida | Timer persistente sin overflow, limpieza de timers/listeners y ausencia de emisión después del cierre |

Prueba unitaria: realtimeAutorizacion.test.js con código real y dobles controlados de reloj/DB/transporte. Reproducción previa y corrección se conservan en el mismo contrato, sin omitirlo. Ensayo real: backend-recuperacion.browser.cjs, subcaso SOCKET_REVOCACION_Y_VENCIMIENTO; usa registros/login HTTP, sockets Chromium reales, JWT HS256 con secreto efímero del ensayo, identidad/suscripción Mongo y bus personal reales. No se crea servicio ni dependencia nueva.

## Límites

Revocación se revisa antes del siguiente aviso; un socket revocado ocioso puede seguir conectado hasta ese aviso o hasta expirar. Un paquete ya emitido/encolado antes de revocar no puede retirarse retroactivamente. No se promete atomicidad entre actualización de identidad y entrega de red ni entrega exactamente una vez. Un error al validar bloquea el aviso, pero no elimina datos financieros; recuperación por HTTP conserva sus contratos.

El recorrido cubre sockets locales del namespace con el adapter de memoria actual; no acredita adapter distribuido ni escalado horizontal. La suite Redis existente no prueba distribución de sockets. Arranque productivo, roles/índices reales, custodia independiente, respaldo independiente protegido/retención, recuperación operacional/RPO-RTO, dispositivos físicos y revisión independiente #407 siguen pendientes.

## Plan recuperable

Registrar resultados del SHA publicado, incluidos CI nativa y browser/backend. Tras aprobar, revisar cierre de sesión explícito y conservación de diarios frente a desconexión por autorización; priorizar solo defectos demostrados. No merge a feature ni Render hasta completar todos los criterios. Main/Empresarial/Blushéa y datos reales no se modifican; sin nuevos planes o servicios.


## Cierre funcional verificado r67
SHA de código 91dd1677f9f60b57110de30e5a583f21a245da1b; árbol 0e1ce738f26c3ccce354ee8024ceae9a0795cfb4. Gate 43144928502, Seguridad 43144928544 y V81 43144928521 satisfactorios. Job autorizado 130940412247: Mongo nativo 81/81 y browser/backend 4/4 (restauración, cierre, sockets y padre), cero fallos/omisiones. Chromium 151.0.7922.34 con JWT HS256, identidad/suscripción Mongo y Socket.IO reales. FP_SOCKET_EVIDENCIA confirmó revocación de socket abierto antes del próximo aviso, vencimiento ocioso, suscripción, aislamiento y reconexión con JWT nuevo. La prueba controlada inicial entregaba 1 aviso indebido; el contrato corregido exige 0 y pasa.
Local: seis pruebas de autorización; módulo completo 620/611/9 y CI personal 338/334/4, cero fallos. Dirigidas/contratos 22/22; sintaxis y diff --check satisfactorios. El nuevo índice por usuario limita cada envío a los sockets del destinatario; consulta compartida solo durante ese aviso. El cierre elimina timers/listeners y afecta solo namespace personal.
Backup V19 del ensayo nativo: 39 colecciones, 5594 documentos, 3882946 bytes, captura 200 ms, restauración 970 ms y edad 1136 ms; custodiaIndependiente=false y rpoProduccion=false. No son métricas operativas reales. La fuente y los efectos financieros no se modifican por revalidar un aviso.
El commit descendiente conserva evidencia y también requiere CI exacta verde. Persisten límites: no retirada de paquetes ya emitidos, revocado ocioso cerrado al siguiente aviso o expiración, adapter de memoria local; no acredita distribución horizontal ni producción. Siguiente: comprobar cierre de sesión explícito y conservación de diarios ante desconexión por autorización, con prueba antes de cambiar semántica. #407/custodia independiente/operación/dispositivos pendientes. No merge a feature ni Render; main/Empresarial/Blushéa/datos reales sin cambios, sin servicios/planes nuevos.
