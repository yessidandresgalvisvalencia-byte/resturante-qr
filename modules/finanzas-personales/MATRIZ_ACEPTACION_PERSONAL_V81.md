# Matriz de aceptación y prioridad — revisión r90

Corte: revisión del 13 de noviembre de 2026, código `1625eddb5b43ac8cbdbab9d66fa52fa926d80e55`, lote base `059067a4fe79e58c06374d9b5214ad7e092b6622`. PR389 abierto; base personal `652126a03f19fbec3c529cad1e84bff11cd3699e`. No es certificación ni autorización de despliegue. La evidencia histórica y sus límites permanecen en CONTINUIDAD_V81.md y documentos enlazados; verificar siempre CI del HEAD actual. “Verificado en ensayo” significa solo el alcance de pruebas descrito, no producción ni todos los casos posibles.

| Área solicitada | Evidencia disponible | Brecha/estado de aceptación |
| --- | --- | --- |
| Caja diaria/Disponible Hoy/compra | HOME_SNAPSHOT_V81.md, HORIZONTE_INGRESO_V81.md, EVALUACION_OBLIGACIONES_VERIFICADA_V81.md; CI con fuentes autorizadas y C2 determinístico | Ensayos implementados; compatibilidad histórica, saldos/roles/índices reales y verificación productiva pendientes. No saldo bancario garantizado |
| IA/cálculo/asesoría | Clasificación, cálculo y orientación separados; evidencia conversacional y guard de operación incierta en continuidad | No se acepta recomendación monetaria con datos desconocidos; auditoría independiente pendiente |
| Correcciones/anulaciones/restauración | Eventos compensatorios y ciclos de deuda/cuenta/activo/inversión/pagos con recibos; Mongo81/81 de padre | Evidencia de ensayo, #407 permanece abierto. La cadena local no prueba custodia externa ni ausencia de otros administradores |
| Ingresos previstos y recibidos | Calendario append-only, recepciones parciales/cierre, proyección y diarios recuperables | Implementado y ensayado en su alcance; no garantiza cobro futuro |
| Historial y diario manual | Copia cifrada, archivo sin poda, originales, estados históricos, formulario por propietario | r88 verificó fallo silencioso del control y confirmación cerrada sin reenvío; no repetir capacidades ya completas |
| Captura conversacional | Texto/canal/recibo persistidos, copia y archivo de diario, aprobación explícita separada | r89 verificó descarte/restauración a revisión con confirmación, auditoría, recibos, propietario y carrera contra aprobación: Mongo82/82 y navegador17/17. Ver CICLO_BORRADOR_PERSONAL_V81.md. Legado ambiguo/recuperación física y verificación productiva siguen fuera del alcance |
| Ahorro/metas | Alta/listado/recibo y recuperación de respuesta con confirmación, fuente original y caja separada; METAS_DECLARADAS_PERSONAL_V81.md | r90 verifica el alcance de declaración y consulta; ciclo de corrección/retiro/restauración por eventos y ahorro con efectos financieros siguen pendientes. No acredita efectivo reservado |
| Guard transversal de fallos | Control de pendientes por dueño, hashes y recibos específicos | Fallo reproducido y corregido en r88: lectura posterior y resolución explícita de confirmación; CI exacta documentada. No prueba durabilidad física del navegador |
| Backup independiente/retención/restauración | Respaldo BSON cifrado V21 con42 colecciones, compatible V20/40 y anteriores, restauración aislada ensayada y métricas del código documentado | Custodio/destino independiente real, retención protegida, control de acceso/credenciales separadas y RPO/RTO operacionales siguen pendientes. Ensayo no constituye backup de producción |
| Mongo insert-only/índices/migración | Auditoría de privilegios, rol restringido en runner, rollback, preservación histórica y provisión planificada | Necesita evidencia real de aplicación para todas las24 colecciones protegidas y demás fuentes, credenciales efectivas, índices/explain y compatibilidad histórica. No ejecutar provisión/migración productiva para aparentar cierre |
| Seguridad y CI | Gate, Seguridad y V81 padre success; validación, aislamiento y concurrencia sintéticos | Revalidar SHA exacto publicado; no sustituye auditoría independiente ni prueba escala de un millón |
| Dispositivos e interfaz | Chromium, HTML real/API y backend autorizado, vistas390/768/1440 en alcances documentados | iPhone/Safari/WebKit, dispositivos físicos/táctil y aprobación de experiencia pendientes |
| Render final | Servicio personal identificado en gate; observaciones históricas de salud separadas del PR | No desplegar versiones parciales. Confirmar branch, SHA live, configuración, HTTP, persistencia, conexión e índices/permisos solo cuando todos los criterios previos estén satisfechos |

## Orden de trabajo recuperable

1. Confirmar CI del descendiente documental de r90 y revisar HEAD exacto. El alcance de alta/consulta de metas debe conservar sus límites; no confundir ensayo con producción.
2. Implementar ciclo de corrección/retiro/restauración de metas por eventos, con confirmación, recuperación del dueño e idempotencia. No convertir ahorro declarado en disponible ni inferir efectivo reservado.
3. Revisar auditoría contextual de IP/dispositivo y redacción de datos del ciclo: el nuevo evento conserva dueño/fecha/cuerpo/hash, pero no aporta esos campos de contexto. No presentar su auditoría como certificación externa.
4. Contrastar requisitos operacionales con evidencia autorizada disponible. Preparar verificaciones reproducibles independientes sin contratar, elevar costos o eludir permisos; registrar lo que falta.
5. Revisión independiente y dispositivos. Solo con todos los criterios, CI exacta y compatibilidad operativa: integrar a feature y verificar deploy personal. Hasta entonces, sin fusión ni Render.

No se asigna porcentaje global de preparación: casos ensayados, trabajo pendiente y requisitos externos no tienen pesos equivalentes. Nunca eliminar controles para convertir un bloqueo en aprobación.

## Resultado de r88

El bloque transversal aprobó en `5f12cd58a56c80e1f22d90ded7866ed0db2f7536`: Gate43356081496/Seguridad43356081505/V8143356081566 success, job131658330551 Mongo81/81 y navegador/backend16/16. Evidencia y fallo inicial resuelto en CONTROL_PERSISTENCIA_PERSONAL_V81.md. El descarte y metas siguen abiertos. Este cierre documental requiere CI exacta propia; no habilita liberación ni Render.

## Actualización r89 — ciclo de borradores

Se implementa el bloque pendiente de descarte/restauración a revisión con confirmación, recibo, originales, idempotencia y aislamiento; no convierte restauración en aprobación. Historial protegido nuevo y respaldoV20/40 compatibleV19/39. Evidencia/límites en CICLO_BORRADOR_PERSONAL_V81.md; pruebas autorizadas del SHA publicado pendientes antes de marcarlo verificado en ensayo. Legado ambiguo, recuperación física de proyección eliminada, custodia y operación reales no se certifican. Siguiente prioridad funcional: inventario metas/ahorro; requisitos externos de #407 siguen bloqueando liberación.

## Verificación r89

Código673a75654b4ac0a034979f1876742cd841760a5b, árbol557bc146de0de8ddbd7ce645231df54fd6a62cb1: Gate43375659529/Seguridad43375659411/V8143375659365 success, job131721445416 Mongo82/82 y navegador17/17, cero fallos/omisiones. Respaldo sintético40 colecciones/5618 documentos/3917586 bytes; captura176ms/restauración1710ms/edad1857ms, custodiaIndependiente=false/rpoProduccion=false. Evidencia completa y límites en CICLO_BORRADOR_PERSONAL_V81.md. La sección anterior de actualización era planificación previa a CI; este resultado la sucede. Metas y requisitos externos siguen abiertos. Descendiente documental requiere sus tres CI exactas, sin autorización de Render.

## r90 — alta de metas declaradas
Alta explícita, listado propio, recibo vinculante y recuperación de respuesta implementados en integración; no reservan caja ni generan ingresos. Original y recibo protegidos, respaldoV21/42 compatibleV20/40. METAS_DECLARADAS_PERSONAL_V81.md contiene contrato, aceptación y límites. CI del SHA nuevo pendiente antes de marcar verificado. Ciclo de metas por eventos y criterios externos #407 siguen pendientes. Sin autorización Render.


## Verificación r90
Código1625eddb5b43ac8cbdbab9d66fa52fa926d80e55/árbol231a8347592c3230c9877122e67c4f8223fa3518: Gate43380325869/Seguridad43380325786/V8143380325830 success; job131736344812 Mongo83/83 y navegador/backend18/18, sin fallos/omisiones/cancelaciones. Alta/listado/recibo de metas declaradas verificados en su alcance; recuperación de respuesta, originales, aislamiento, rollback, concurrencia, permisos y caja intacta. Respaldo sintético42colecciones/6136documentos/4090994bytes, captura251ms/restauración1063ms/edad1251ms, sin custodia independiente ni RPO productivo. Informe/límites/fallos corregidos: METAS_DECLARADAS_PERSONAL_V81.md. Descendiente documental requiere CI exacta propia. Próximo: ciclo por eventos de metas. #407 y criterios globales siguen abiertos; sin merge ni Render.

## r91 — ciclo de metas en validación
Corrección/retiro/restauración e historial de metas declaradas con recibo, sin modificar fuente ni caja. Cursor técnico compartido serializa creación y correcciones; proyección activa deriva de eventos. UI con confirmación, motivo, versión y recibos recuperables. Política25 y respaldoV22/44 compatibleV21/42. Criterios y límites en CICLO_METAS_PERSONAL_V81.md. No marcar aprobado hasta CI/ensayos autorizados del SHA nuevo. Legados, auditoría contextual y criterios externos #407 permanecen abiertos. Sin merge/Render.
