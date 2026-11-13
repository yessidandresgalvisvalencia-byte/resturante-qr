# Matriz de aceptación y prioridad — revisión r95 (en validación)

Corte: revisión del 13 de noviembre de 2026, base real `9b8af4bcb248cd9befaa2e6e50d891a44db31819`. r95 en validación: CONTEXTO_AUDITORIA_CUENTAS_PERSONAL_V81.md. r94 verifica revisión privada de formato/nombres BSON; código `fea0387bc5588ff880e7228408335b10e28ccedc`, tres CI verdes y Mongo87/87 + navegador/backend22/22: REVISION_FUENTES_METAS_PERSONAL_V81.md. Código r93 `aaa871df7c3e454af8de483fc210b9813de70122`, tres CI verdes y Mongo86/86 + navegador/backend21/21. CONTEXTO_AUDITORIA_METAS_PERSONAL_V81.md. PR389 abierto; base personal `652126a03f19fbec3c529cad1e84bff11cd3699e`. No es certificación ni autorización de despliegue. La evidencia histórica y sus límites permanecen en CONTINUIDAD_V81.md y documentos enlazados; verificar siempre CI del HEAD actual. “Verificado en ensayo” significa solo el alcance de pruebas descrito, no producción ni todos los casos posibles.

| Área solicitada | Evidencia disponible | Brecha/estado de aceptación |
| --- | --- | --- |
| Caja diaria/Disponible Hoy/compra | HOME_SNAPSHOT_V81.md, HORIZONTE_INGRESO_V81.md, EVALUACION_OBLIGACIONES_VERIFICADA_V81.md; CI con fuentes autorizadas y C2 determinístico | Ensayos implementados; compatibilidad histórica, saldos/roles/índices reales y verificación productiva pendientes. No saldo bancario garantizado |
| IA/cálculo/asesoría | Clasificación, cálculo y orientación separados; evidencia conversacional y guard de operación incierta en continuidad | No se acepta recomendación monetaria con datos desconocidos; auditoría independiente pendiente |
| Correcciones/anulaciones/restauración | Eventos compensatorios y ciclos de deuda/cuenta/activo/inversión/pagos con recibos; Mongo81/81 de padre | Evidencia de ensayo, #407 permanece abierto. La cadena local no prueba custodia externa ni ausencia de otros administradores |
| Ingresos previstos y recibidos | Calendario append-only, recepciones parciales/cierre, proyección y diarios recuperables | Implementado y ensayado en su alcance; no garantiza cobro futuro |
| Historial y diario manual | Copia cifrada, archivo sin poda, originales, estados históricos, formulario por propietario | r88 verificó fallo silencioso del control y confirmación cerrada sin reenvío; no repetir capacidades ya completas |
| Captura conversacional | Texto/canal/recibo persistidos, copia y archivo de diario, aprobación explícita separada | r89 verificó descarte/restauración a revisión con confirmación, auditoría, recibos, propietario y carrera contra aprobación: Mongo82/82 y navegador17/17. Ver CICLO_BORRADOR_PERSONAL_V81.md. Legado ambiguo/recuperación física y verificación productiva siguen fuera del alcance |
| Ahorro/metas | Alta/listado/recibo y ciclo por eventos conservando fuente y caja; METAS_DECLARADAS_PERSONAL_V81.md / CICLO_METAS_PERSONAL_V81.md | r92 verifica adopción explícita de legados válidos y ciclo conservando fuente/estado, sin inventar creación ni caja. ADOPCION_METAS_PERSONAL_V81.md. r93 verifica contexto minimizado y compromiso público en nuevos recibos/eventos, sin exponer tokens; Mongo86/86 y navegador21/21. No acredita cliente real ni identidad del dispositivo. r94 permite consultar hallazgos de fuentes ambiguas sin repararlas ni verificar cadena/estado actual. Resolución explícita de legados ambiguos/corruptos, contexto de otros flujos y ahorro con efectos financieros siguen pendientes. No acredita efectivo reservado |
| Guard transversal de fallos | Control de pendientes por dueño, hashes y recibos específicos | Fallo reproducido y corregido en r88: lectura posterior y resolución explícita de confirmación; CI exacta documentada. No prueba durabilidad física del navegador |
| Backup independiente/retención/restauración | Respaldo BSON cifrado V25 con44 colecciones, compatible V22/44 y anteriores, restauración aislada ensayada y métricas del código documentado | Custodio/destino independiente real, retención protegida, control de acceso/credenciales separadas y RPO/RTO operacionales siguen pendientes. Ensayo no constituye backup de producción |
| Mongo insert-only/índices/migración | Auditoría de privilegios, rol restringido en runner, rollback, preservación histórica y provisión planificada | Necesita evidencia real de aplicación para todas las25 colecciones protegidas y demás fuentes, credenciales efectivas, índices/explain y compatibilidad histórica. No ejecutar provisión/migración productiva para aparentar cierre |
| Seguridad y CI | Gate, Seguridad y V81 padre success; validación, aislamiento y concurrencia sintéticos | Revalidar SHA exacto publicado; no sustituye auditoría independiente ni prueba escala de un millón |
| Dispositivos e interfaz | Chromium, HTML real/API y backend autorizado, vistas390/768/1440 en alcances documentados | iPhone/Safari/WebKit, dispositivos físicos/táctil y aprobación de experiencia pendientes |
| Render final | Servicio personal identificado en gate; observaciones históricas de salud separadas del PR | No desplegar versiones parciales. Confirmar branch, SHA live, configuración, HTTP, persistencia, conexión e índices/permisos solo cuando todos los criterios previos estén satisfechos |

## Orden de trabajo recuperable

1. Confirmar CI del descendiente documental de r95 y revisar HEAD exacto. El alcance de ciclo de metas debe conservar sus límites; no confundir ensayo con producción.
2. Completar auditoría contextual minimizada IP/dispositivo y acceso/retención; revisar legados ambiguos/corruptos sin alterar sus fuentes ni inventar historia. No convertir ahorro declarado en disponible ni inferir efectivo reservado.
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


## Verificación r91
Código cf6a2fe2f3dbfc0dd67fa1218e88fbe79aec3e00/árbol d73be21953aba38963fd28fd6b8e98d803fcd7e9: Gate43392543071/Seguridad43392543059/V8143392543054 success; job131775670906 Mongo84/84 y navegador/backend19/19, sin fallos/omisiones/cancelaciones. Ciclo de metas con recibo, fuente preservada, proyección, recuperación e historial verificados en su alcance. Reserva de capacidad admite restauración1000; rechazo409 posterior conserva estado; límite global5000 validado en C2. Respaldo sintético44colecciones/7206documentos/7252714bytes, captura243ms/restauración1516ms/edad1728ms, sin custodia independiente ni RPO productivo. Informe y límites: CICLO_METAS_PERSONAL_V81.md. Descendiente documental requiere CI exacta propia. Próximo: adopción legacy y auditoría contextual. #407/operación/dispositivos/custodia/auditoría pendientes; sin merge/Render.

## r92 — adopción de metas en validación
ADOPCION permite revisar y confirmar fuentes legacy válidas antes de gestionar su ciclo, preservando original/estado/caja y sin inventar creación o historia anterior. Recuperación por recibo y consentimiento aislado en UI; semántica de respaldoV23/44 con lecturaV22/44. ADOPCION_METAS_PERSONAL_V81.md define aceptación y límites. Nuevos SHA/CI/ensayos pendientes antes de cierre. Datos ambiguos/corruptos, auditoría contextual y gates externos #407 siguen abiertos. Sin merge/Render.


## Verificación r92
Código febee86a79bc53df29dfd6d01b6103c95d83acd0/árbol31b5a7c50ce84b204b43c8c6a062b282d6ce680e: Gate43405360080/Seguridad43405359967/V8143405359971 success; job131818263657 Mongo85/85 y navegador/backend20/20 sin fallos/omisiones/cancelaciones. Adopción de metas antiguas válidas verificada con consentimiento, fuente/estado preservados, respuesta recuperable e ingreso/saldo100000 sintéticos intactos. No inventa recibo de creación ni historia anterior. RespaldoV23 sintético44colecciones/7229documentos/7278150bytes, captura269ms/restauración941ms/edad1137ms; sin custodia independiente ni RPO productivo. ADOPCION_METAS_PERSONAL_V81.md contiene alcance/límites. Descendiente documental requiere CI propia. Próximo: auditoría contextual y revisión de legados ambiguos/corruptos; #407/operación/dispositivos/custodia/auditoría pendientes. Sin merge/Render.


## Corte verificado r93
Código aaa871df7c3e454af8de483fc210b9813de70122/árbol c5cf7b122e6675820e61e98b880d5101f12ff29d: Gate43415652150, Seguridad43415652181 y V8143415652159 success; ocho jobs V81 y job131852743320 Mongo86/86, navegador/backend21/21 sin omisiones. Contexto HTTP de metas ligado al hash, minimizado y privado; legacy/internal explícitos. Rollback sin clave, replay sin clave, rotación, separación de dueño y hash público ensayados. Corregida consulta tardía del calendario que ocultaba rechazo de copia ajena; evidencia roja/verde en continuidad. BackupV24/44:7236docs/7328830bytes, captura284ms/restore1194ms/edad1478ms, sintético y sin custodia independiente ni RPO productivo.

Pendiente: contexto de otros flujos, históricos ambiguos, verificación de proxy/rate limit real, configuración/custodia de claves y retención operacional. Continúan todos los gates externos de #407; no marcar producto listo ni desplegar. Siguiente paso y resultados exactos del descendiente documental en PR389 y CONTINUIDAD_V81.md.


## Corte verificado r94
Código fea0387bc5588ff880e7228408335b10e28ccedc/árbol31b2c2d99fff574c4bdf59576e2df3fbe777ef95: Gate43420810444, Seguridad43420810309 y V8143420810359 success, ocho jobs V81. Job131870026715 Mongo87/87 y navegador/backend22/22 sin fallos/omisiones. Revisión de formato/nombres de fuentes propias con huella BSON y capacidad cerrada; listado normal conserva fallo frente a originales inválidos. No repara, adopta, omite fuentes ni verifica cadena/estado actual. UI390 conserva formulario, texto literal y originales; cero POST. Fallos intermedios de cache401/test estático corregidos sin desactivar gates.

Backup aislado V24/44:7759docs/7453822bytes, captura218ms/restore2076ms/edad2296ms, sintético sin custodia independiente/RPO productivo. Siguiente: resolución explícita preservando originales y auditoría contextual de otros flujos. Los gates externos de #407/operación/productivo/dispositivos continúan pendientes; sin merge/Render. CI del descendiente documental queda en PR389.


## Plan r95
Apertura/retiro/restauración de cuentas con contexto minimizado y compromiso, dominios independientes de metas y mismos originales/saldos. Sin evidencia de CI exacta todavía. No cubre conciliaciones ni otros flujos; retención, clave productiva y topología de proxy/rate limit reales siguen pendientes. Revisión/resolución de metas ambiguas sigue pendiente; no reparar ni omitir automáticamente.
