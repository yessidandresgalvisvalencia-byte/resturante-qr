# Persistencia verificable del control de operaciones — r88

## Partida y bloque elegido

HEAD real `90b095d41ee97cd985b7d1ffec8e459a7e0827eb`, árbol `913ca26697308a5b267fb382ad956782621548f9`. PR #389 abierto/sin fusión sobre `feature/finanzas-personales` (`652126a03f19fbec3c529cad1e84bff11cd3699e`); única rama de escritura `integration/fp-hormiga-clasificacion-credito-v81`. #407 es un issue abierto, con seis criterios vigentes. CI inicial exacta success: Gate43349080203, Seguridad43349080176, V8143349080231. Instrucciones, README y continuidad revisados; sin AGENTS.md local. Fechas de próximo ingreso y compra estricta constan resueltas en continuidad; no se repiten.

La revisión de aceptación detectó descarte de borradores sin confirmación/recibo/restauración accesible. Al inspeccionar su integración apareció un riesgo anterior y transversal: el control central confiaba en setItem sin verificar lectura posterior, a diferencia de los diarios recientes. Se prioriza un bloque completo de protección de persistencia y recuperación de confirmación. El descarte recuperable NO se implementa ni cuenta como completado aquí; queda como siguiente brecha en la matriz.

## Reproducción y causa

Se ejecutó el módulo original del árbol padre en VM con almacenamiento que ignora setItem y retorna null: iniciar('/transacciones') entregó opciones de envío sin persistir ningún control. Reproducción sintética: `opcionesEntregadas=true, persistenciaReal=false, bugReproducido=true`. La API real usa esas opciones antes de fetch: sin lectura posterior no podía detectar ese fallo silencioso. No fue una pérdida observada de datos reales.

Después de un commit del servidor, si guardar la retirada del pendiente era ignorado, el control quedaba persistido aunque el diario manual ya se hubiera confirmado. Su tarjeta cerrada no ofrecía la consulta de confirmación original, necesaria para resolver el control sin un nuevo envío. Leer Home no acredita una solicitud específica.

## Aceptación e implementación

| Criterio | Resultado |
| --- | --- |
| Persistir antes de enviar | Serializa pendientes, guarda y compara lectura posterior exacta. Excepción, cuota, escritura ignorada o lectura diferente activa error y falla antes de devolver opciones a la API |
| Alcance transversal | Mismo guard para header, externalId, solicitudId y operaciones sin clave; no se reclasifican rutas ni se exceptúan mutaciones desconocidas |
| Cierre fallido | La retirada de un pendiente exige igual lectura posterior. Los catch existentes reponen su entrada en memoria, conservan los demás y bloquean C3. Si la escritura fue ignorada, el original almacenado permanece |
| Sin desbloqueo ficticio | Respuesta HTTP, lectura Home o cambio de otra instancia no desbloquean una instancia que falló al guardar. Requiere recarga/verificación explícita; no se vacía ni reconstruye automáticamente un registro dañado |
| Registro manual cerrado | Nueva acción “Verificar confirmación del registro” consulta POST de solo lectura /transacciones/confirmar-intento con cuerpo original. La API contrasta la huella/propietario y quita únicamente el control coincidente cuando su persistencia es verificable |
| No reenvío | resolver admite CONFIRMADA solo en modo consulta. Reenvío de registro cerrado se rechaza antes de llamar API. Fuente ANULADA/CORREGIDA no se interpreta como registro activo ni se reactiva |
| Conservación | Mantiene UUID, cuerpo, constancia y formulario nuevos. No inventa identificadores ni altera fuentes financieras, caja, capital, reservas o historial para resolver un control local |
| Aislamiento/carreras | JWT renovado usa el mismo dueño; otro dueño mantiene control propio. Doble operación activa rechaza; respuesta tardía de otra sesión no pinta ni confirma su diario |

La lectura posterior prueba disponibilidad inmediata mediante la API del almacenamiento del navegador; no garantiza escritura física durable, integridad ante administrador, respaldo independiente o supervivencia a borrado del navegador. Si un adaptador altera activamente el contenido, se bloquea pero no se afirma que preservó los bytes que ese adaptador cambió. No borrar datos para desbloquear.

## Pruebas

```bash
node --test test/finanzas-personales/persistenciaControlPersonal.test.js test/finanzas-personales/controlMutacionesFinancieras.test.js test/finanzas-personales/formularioManualPersonal.test.js test/finanzas-personales/copiaDiarioManual.test.js test/gruk/frontend-version-aislamiento-personal.test.js test/gruk/hormiga-version-javascript-personal.test.js
node --test test/finanzas-personales/*.test.js
npm run ci:personal
# Solo en runner de ensayo aislado y autorizado:
node --test test/finanzas-personales/browser/backend-recuperacion.browser.cjs
```

Trece casos nuevos: API real extraída ejecutada con cero fetch para los cuatro mecanismos; lectura alterada/cuota; cierre CONFIRMADA/RECHAZADA/NO_ENVIADA; confirmación ignorada conserva otros pendientes; propietario, concurrencia y recarga; API con commit y cierre fallido; tarjeta manual cerrada consulta sin reenvío; fuente no activa y respuesta tardía. Nuevas13/13, módulo803 totales/794 aprobadas/9 omitidas, ci:personal353/349/4, cero fallos. Node24 local frente Node20 CI. Las omisiones por servicios externos no acreditan operación. Sintaxis del runner aprobada; dirigidas finales y CI exacta se registran al cierre.

Nuevo escenario nativo, sin relajar timeout ni gates: ignora solo escrituras del control central antes del envío, conserva solicitud manual completa y cero POST financieros; recarga y reenvío explícito con misma clave crea un único movimiento. Ignora cierre del control después del commit; conserva pendiente y fuente única. Confirmación de diario puede quedar cerrada mientras control aún bloquea. Recarga y nueva acción de consulta propia resuelven únicamente ese control, sin POST financiero adicional y con originales/foto intactos. Emite FP_CONTROL_PERSISTENCIA. Se mantienen los casos previos; objetivo16 pruebas de navegador/backend, pendiente del SHA exacto publicado, sin atribuir ejecución local nativa.

## Siguiente paso y límites de liberación

Matriz priorizada en MATRIZ_ACEPTACION_PERSONAL_V81.md. Siguiente bloque: descarte/restauración de borradores con confirmación, propietario, eventos originales/recibos, idempotencia y pruebas normales/fallos/carreras. Evaluar colección/índices/permisos/backup y aprobación concurrente antes de cambiar rutas. No restaurar un borrador aprobando sus operaciones financieras. Metas/ahorro requieren después inventario propio de idempotencia, recuperación y evidencia; no se consideran completos por tener endpoint de creación.

Publicación con árbol local/remoto idéntico y expected_sha/force=false. #407, custodio real, backup operacional independiente con acceso/retención/credenciales separadas/RPO-RTO, permisos e índices productivos y dispositivos/auditoría/compatibilidad permanecen pendientes. Sin merge a feature ni main, sin Render, migraciones, costos, otros productos o datos reales modificados. Tarea existente comprobada habilitada.

## Incidencia del primer ensayo remoto

Código `9b43291a2b59699178309deb76737104884663ad`, árbol `2658115e58794c2172cd648826002ba6b6ff285b`: Gate43355565989 y Seguridad43355565972 success; V8143355566060 failure. Job131656671045: Mongo81/81 aprobadas, navegador16 totales/14 aprobadas/2 fallos (subtest nuevo y su contenedor), sin omisiones/cancelaciones. Los casos anteriores aprobaron; no se describe este SHA como CI completamente verde.

El nuevo caso llegó a un único commit y falló al comparar aplicada.t[0].externalId con el UUID local. TransaccionPersonal guarda externalIdHash, no el identificador en claro; flujoCaja calcula HMAC-SHA256 con secreto de idempotencia y usuario. Se corrige la aserción para comparar ese hash con el HMAC esperado de usuario+UUID original. Se mantienen cantidad única, clave original del control y las verificaciones de cierre/recuperación posteriores; no se elimina la aserción de identidad ni se cambia código de producción para satisfacerla. La comprobación posterior al punto fallido aún requiere ejecución remota nueva.

Sintaxis del runner aprobada y dirigidas de control/persistencia22/22, cero fallos/omisiones tras ajuste. Publicar corrector con lease y confirmar de nuevo tres workflows del SHA exacto. No hay merge, Render ni gates/timeouts relajados. El descarte recuperable permanece como siguiente bloque.
