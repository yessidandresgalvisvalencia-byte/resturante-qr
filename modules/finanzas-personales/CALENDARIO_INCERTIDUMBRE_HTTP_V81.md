# Calendario: incertidumbre conservada ante errores HTTP V81

## Plan y alcance r79 · 2026-11-12
Padre verificado `bf6a42edf3d5ac8a34c94c1722380c2b055279ad`, árbol `aa0b1046ad58c292fa9817156223af4a95801f24`; integración `integration/fp-hormiga-clasificacion-credito-v81`, PR #389 abierto, base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`. #407 revisado abierto. Tres CI del padre verdes: Gate 43242430658, Seguridad 43242430636, V81 43242430778; job 131266151811 Mongo 81/81 y navegador/backend 13/13 sin omisiones.

Un bloque prioritario encontrado antes de extender copias del calendario: el cliente cerraba como RECHAZADA una solicitud ante 400/401/403/404/422/429 aunque careciera de decisión vinculante. Si el primer envío se confirmó pero se perdió la respuesta, un fallo posterior podía ocultar la incertidumbre en la agenda. Un estado HTTP aislado no demuestra el resultado financiero de la solicitud original.

## Implementación y aceptación
- La API personal conserva incertidumbre general en errores de calendario sin rechazo verificable. La agenda no cierra por código HTTP ni por una bandera sin prueba. Conserva cuerpo, solicitudId y formulario; reenvío solo explícito con los mismos datos, sin nueva clave.
- CONFIRMADA exige recibo propio existente; RECHAZADA exige volver a verificar el rechazo con dueño/ruta/cuerpo/clave. Sigue admitiendo VERSION_SUPERADA y RECEPCION_NO_APLICADA válidos con los criterios existentes, sin confundirlos con recibos de caja.
- Rechazos históricos se mantienen físicamente intactos al abrir la app. Se consideran pendientes efectivos hasta validar su prueba local en la sesión actual o consultar recibo del servidor. Las pruebas válidas se cotejan sin red implícita; sesión/cuerpo/prueba cambiados invalidan esa autorización. Sin prueba suficiente, no se habilita nueva solicitud ni se inventa un cierre.
- Pendiente efectivo de calendario bloquea C3 aun sin registro general de incertidumbre. Botones de consulta/reenvío están disponibles para el rechazo antiguo sin prueba. GET posterior conserva cuerpo/clave y no ejecuta otro cambio. Confirmar/rechazar verificado aumenta revisión y retira autorización de cifras anteriores.
- Raíz vacía/corrupta falla cerrada. Escritura con excepción o ignorada se verifica mediante lectura posterior y no declara cierre guardado. No se limpia ni reemplaza automáticamente un diario.
- Cambiar sesión descarta verificaciones/respuestas tardías y conserva borradores del usuario siguiente. No se altera ningún ledger, saldo, fuente o historial del servidor al revalidar evidencia local.

## Pruebas y límites de ejecución
Antes de la desconexión del ejecutor local pasaron 45 pruebas dirigidas de calendario/versiones; se corrigió un error de sintaxis de construcción y se sustituyó una fixture de rechazo incompleta por una prueba vinculante real. No se presenta ese resultado como aprobación del lote final.

El entorno local dejó de estar disponible durante la ampliación; no hay escalación ni permisos eludidos. Se reconstruyeron fuentes desde el SHA remoto verificado, se compilaron con V8 y se comprobaron diez condiciones dirigidas (pendiente histórico, conservación original, bloqueo de alta, 401 conservado, GET que confirma, rechazo válido sin red, limpieza de autorización por sesión, prueba inválida y raíz corrupta). Esto no reemplaza las suites Node ni la CI.

Diez pruebas Node añadidas en calendarioInterfaz.test.js cubren matriz 400/401/403/404/409/422/429/500/503, incertidumbre previa y pago ajeno, bandera de rechazo sin prueba, histórico sin registro general, prueba válida/inválida, respuesta tardía entre sesiones, cuota/escritura ignorada y raíz corrupta. Suite completa Node y CI personal del lote final: pendientes de resultados reales de CI, sin omitir pruebas ni cambiar workflows/gates/timeouts.

Un escenario nativo nuevo en backend-recuperacion.browser.cjs usa calendario real sintético, POST confirmado con respuesta abortada y reintento con mismo cuerpo/clave que llega al backend con JWT inválido y responde 401. Exige raíz pendiente intacta y bloqueo de otra alta. Otra pestaña con login real recibe una fixture explícitamente sintética del rechazo antiguo, sin diario general: apertura no la reescribe, C3 queda bloqueada y GET propio posterior confirma sin POST de recuperación. Cuerpo/clave, pestaña fuente, calendario y snapshot financiero deben permanecer intactos. Verificar registro FP_CALENDARIO_HTTP_INCIERTO y 14 casos nativos antes de declarar cierre.

## Siguiente paso y bloqueos
Verificar las tres CI del SHA publicado, registrar SHA/jobs/resultados y corregir cualquier fallo. Después: copia cifrada del diario de calendario/captura y capacidad sin poda, ya con cierre conservador de incertidumbre. Si un histórico no tiene recibo ni decisión suficiente, permanece bloqueado; no se supone que no se aplicó.

#407, custodio independiente real, backup protegido/retención/claves separadas/restauración operacional con RPO/RTO, permisos e índices productivos, dispositivos físicos y compatibilidad siguen pendientes. Este lote no acredita esas condiciones ni una auditoría externa. Sin merge ni Render, sin cambios en main/Empresarial/Blushéa, sin datos reales ni costos nuevos.
