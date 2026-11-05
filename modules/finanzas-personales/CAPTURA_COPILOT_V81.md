# Captura copilot recuperable — contrato 2

POST /copilot exige Idempotency-Key copilot_ estable (8–80 caracteres alfanuméricos/guion después del prefijo), texto original no vacío hasta 5000 caracteres y canal TEXTO/AUDIO_TRANSCRITO. No admite dueño ni campos extra del cuerpo. Identidad viene del JWT personal existente. El texto original se conserva sin trim en el recibo y borrador; el turno mantiene el trim histórico de su esquema.

## Comportamiento y aceptación

| Caso | Comportamiento |
| --- | --- |
| Primera captura | Procesar, borrador si corresponde, metadatos directos, turno y recibo en una transacción snapshot/majority |
| Respuesta perdida | GET /copilot/confirmacion/:solicitudId devuelve resultado original y recibo propio; no vuelve a interpretar ni crear borrador |
| POST repetido/concurrente con misma clave y cuerpo | Misma identidad de turno/borrador; conflicto único revierte la transacción perdedora y consulta el recibo ganador |
| Misma clave, otro texto/canal | 409 sin sobrescribir fuentes |
| Mismo texto con clave nueva | Nueva captura deliberada, sin deduplicar hechos legítimos por contenido |
| Otro usuario | Consulta ajena 404; su misma clave no colisiona ni muestra texto ajeno |
| Fallo al escribir turno o recibo | Reversión de borrador/metadatos directos; no queda medio registro |
| Cierre de sesión fallido después del commit | Respuesta no confirmada; GET/reintento estable recupera la captura ya confirmada |
| Borrador posteriormente aprobado | Recibo conserva versión original y no vuelve a poner el borrador pendiente. UI consulta lista vigente; recuperar nunca aprueba |
| Fuente ausente/alterada o índice inseguro | Falla cerrado sin recrear, reparar ni borrar historial |

La nueva colección fin_capturas_copilot_personales_v1 es INSERT-only para el rol de aplicación, con hooks y dos índices únicos exactos (usuario/solicitud y usuario/turno). SHA256 vincula propietario, solicitud, resultado original, turno y fecha. No es un anclaje independiente ni impide reescritura por una credencial administrativa con permisos suficientes. El turno se verifica contra el original conservado; el borrador debe existir y corresponder al propietario/texto. Sus estados de aprobación pueden cambiar legítimamente y no se restauran desde la captura.

procesar admite sesión externa para las escrituras directas de contexto y borrador. La memoria auxiliar de foco de deuda se desactiva en esta ruta para evitar una escritura fuera de la transacción. La asesoría puede consultar Home/otros servicios en snapshots separados; no se certifica una única vista global de todas sus lecturas. Capturar una respuesta no acredita su exactitud financiera completa: master/proyecciones y otras ramas aún requieren revisión. GET y replay conservan respuesta histórica, no recalculan cifras ni autorizan gasto actual. recibo.certificaEstadoActual=false, con fecha y huella explícitas.

La ruta deja de aceptar clientes sin clave o cuerpos normalizados por stripUnknown; actualizar frontend y API juntos antes de liberar. POST no realiza aprobación financiera ni mueve caja. Aprobaciones siguen por sus rutas protegidas con idempotencia propia. Casos inválidos/errores internos devuelven mensaje sanitizado sin respuesta parcial y caché private/no-store.

## Protección y recuperación en interfaz

Antes de limpiar el campo o hacer POST se guarda una solicitud con clave nueva y texto/canal exactos en sessionStorage por usuario. El borrador de texto al escribir y el dictado vigente también se conservan. Ante fallo de almacenamiento, corrupción, 100 entradas o captura anterior pendiente, se bloquea otra captura; no se limpia ni se envía silenciosamente. No hay TTL ni limpieza automática de entradas confirmadas o pendientes.

Al recargar, entrar o cambiar de usuario se muestran solo sus capturas; al cerrar/cambiar se limpia la vista privada, sin borrar solicitudes. Botones permiten consultar el recibo por GET o reenviar explícitamente los mismos datos y clave. No se reintenta automáticamente POST. Una respuesta ajena/tardía no se dibuja ni desbloquea otra captura activa. Recibos se vinculan a la huella canónica exacta del cuerpo antes de confirmar localmente. La respuesta recuperada se presenta como original histórica y no como consejo actualizado. El estado financiero pendiente real sigue bloqueando nuevos POST copilot mediante el control previo; GET de recibo no registra otro pago.

sessionStorage no es backup independiente: depende de la pestaña y de las políticas del navegador, puede perderse al cerrarla o por almacenamiento indisponible. El texto permanece local en claro y es accesible al JavaScript del mismo origen; el aislamiento visual/namespace no protege contra XSS, extensiones o acceso al perfil físico del navegador. No se promete recuperación garantizada de texto que nunca llegó al servidor. Cifrado/acceso del almacenamiento del dispositivo y aceptación real de dispositivos siguen pendientes. La capacidad local limitada requiere futuro flujo explícito de archivo/exportación autorizado, sin borrados automáticos.

## Backup y operación

Backup V17 amplía 34→37 colecciones: recibos de captura, turnos y contexto. Mantiene compatibilidad V1–V16 y preservación BSON/índices. Nueva colección protegida número 18; provisión administrativa separada antes de HTTP, índices también revisados en caliente. No se ejecutan provisiones, migraciones o reparaciones sobre producción. La política y CI no certifican credenciales/índices instalados de Render/MongoDB real.

Pruebas: validación/huellas/hooks/handler; cliente con almacenamiento y recibos alterados, recarga, misma solicitud frente a contenido repetido y sesión ajena; VM de interfaz con pérdida de respuesta y cambio de usuario durante dos capturas. MongoDB autenticado debe comprobar creación/replay/carrera/rollback, aprobación posterior, cierre fallido, propietario, permisos nativos UPDATE/DELETE rechazados, índice ausente y corrupción. Backup aislado debe conservar V17. El transporte/JWT de fixtures es sintético, no una nueva certificación end-to-end de producción o auditoría externa.

Próximo bloque: inventario de captura/históricos para converger UI/API y protección del dispositivo; activación recuperable del calendario, exactitud de master/proyecciones, evaluación de crédito/plan y demás criterios siguen pendientes. #407/custodio real, backup durable con retención/acceso/claves separados, restauración/RPO-RTO operativos, roles/índices/históricos reales y aceptación de seguridad/dispositivos/compatibilidad/informe final permanecen abiertos. Sin merge ni Render, costos o alteraciones de datos reales.
