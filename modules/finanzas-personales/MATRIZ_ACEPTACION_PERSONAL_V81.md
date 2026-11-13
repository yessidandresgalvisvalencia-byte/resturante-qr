# Matriz de aceptación y prioridad — revisión r88

Corte: revisión del 12 de noviembre de 2026, padre `90b095d41ee97cd985b7d1ffec8e459a7e0827eb`. PR389 abierto; base personal `652126a03f19fbec3c529cad1e84bff11cd3699e`. No es certificación ni autorización de despliegue. La evidencia histórica y sus límites permanecen en CONTINUIDAD_V81.md y documentos enlazados; verificar siempre CI del HEAD actual. “Verificado en ensayo” significa solo el alcance de pruebas descrito, no producción ni todos los casos posibles.

| Área solicitada | Evidencia disponible | Brecha/estado de aceptación |
| --- | --- | --- |
| Caja diaria/Disponible Hoy/compra | HOME_SNAPSHOT_V81.md, HORIZONTE_INGRESO_V81.md, EVALUACION_OBLIGACIONES_VERIFICADA_V81.md; CI con fuentes autorizadas y C2 determinístico | Ensayos implementados; compatibilidad histórica, saldos/roles/índices reales y verificación productiva pendientes. No saldo bancario garantizado |
| IA/cálculo/asesoría | Clasificación, cálculo y orientación separados; evidencia conversacional y guard de operación incierta en continuidad | No se acepta recomendación monetaria con datos desconocidos; auditoría independiente pendiente |
| Correcciones/anulaciones/restauración | Eventos compensatorios y ciclos de deuda/cuenta/activo/inversión/pagos con recibos; Mongo81/81 de padre | Evidencia de ensayo, #407 permanece abierto. La cadena local no prueba custodia externa ni ausencia de otros administradores |
| Ingresos previstos y recibidos | Calendario append-only, recepciones parciales/cierre, proyección y diarios recuperables | Implementado y ensayado en su alcance; no garantiza cobro futuro |
| Historial y diario manual | Copia cifrada, archivo sin poda, originales, estados históricos, formulario por propietario | r88 prioriza fallo silencioso del control transversal y consulta de confirmación cerrada; no repetir capacidades ya completas |
| Captura conversacional | Texto/canal/recibo persistidos, copia y archivo de diario, aprobación explícita separada | Brecha real: routes.js /captura/:id/descartar muta estado PENDIENTE a DESCARTADO, sin confirmación/cuerpo/clave; UI discardDraft no confirma y loadDrafts solo lista PENDIENTE/PARCIAL. Texto queda en servidor pero no hay recuperación accesible ni auditoría de ciclo. NO completo |
| Ahorro/metas | Endpoint /metas y formulario; metas declaradas no prueban efectivo reservado | Pendiente inventario y pruebas de flujo completo, exactitud, idempotencia, aislamiento, historial y recuperación. No declarar completo por creación básica |
| Guard transversal de fallos | Control de pendientes por dueño, hashes y recibos específicos | Fallo demostrado en padre al ignorar setItem. Bloque r88: lectura posterior exacta y resolución explícita de registro manual confirmado; resultado exacto al cierre |
| Backup independiente/retención/restauración | Respaldo BSON cifrado V19 con39 colecciones y restauración aislada ensayada | Custodio/destino independiente real, retención protegida, control de acceso/credenciales separadas y RPO/RTO operacionales siguen pendientes. Ensayo no constituye backup de producción |
| Mongo insert-only/índices/migración | Auditoría de privilegios, rol restringido en runner, rollback, preservación histórica y provisión planificada | Necesita evidencia real de aplicación, todas las credenciales y colecciones efectivas, índices/explain y compatibilidad histórica. No ejecutar provisión/migración productiva para aparentar cierre |
| Seguridad y CI | Gate, Seguridad y V81 padre success; validación, aislamiento y concurrencia sintéticos | Revalidar SHA exacto publicado; no sustituye auditoría independiente ni prueba escala de un millón |
| Dispositivos e interfaz | Chromium, HTML real/API y backend autorizado, vistas390/768/1440 en alcances documentados | iPhone/Safari/WebKit, dispositivos físicos/táctil y aprobación de experiencia pendientes |
| Render final | Servicio personal identificado en gate; observaciones históricas de salud separadas del PR | No desplegar versiones parciales. Confirmar branch, SHA live, configuración, HTTP, persistencia, conexión e índices/permisos solo cuando todos los criterios previos estén satisfechos |

## Orden de trabajo recuperable

1. Completar y publicar r88 con pruebas normales/fallos/integración; confirmar tres CI del SHA exacto. Un bloque funcional, no contar matriz como una segunda implementación.
2. Descarte/restauración accesible de borrador: confirmación explícita, estado/versionado actual, propietario JWT, referencia de descarte y evento/recibo idempotentes; conservar texto/items originales, fuente aprobada y carrera contra aprobación; no mover dinero. Incluir índices, rol insert-only del nuevo historial y compatibilidad del respaldo si se necesita nueva colección.
3. Inventariar metas/ahorro; seleccionar una brecha completa demostrable. No convertir ahorro declarado en disponible ni inferir saldo reservado.
4. Contrastar requisitos operacionales con evidencia autorizada disponible. Diseñar/preparar verificaciones reproducibles independientes sin contratar ni elevar costos o eludir permisos. Registrar lo que falta exactamente.
5. Revisión de liberación independiente y dispositivos. Solo con todos los criterios, CI exacta y compatibilidad operativa: integrar a feature y verificar deploy personal. Hasta entonces, sin fusión ni Render.

No se asigna porcentaje global de preparación: casos ensayados, trabajo pendiente y requisitos externos no tienen pesos equivalentes. Nunca eliminar controles para convertir un bloqueo en aprobación.
