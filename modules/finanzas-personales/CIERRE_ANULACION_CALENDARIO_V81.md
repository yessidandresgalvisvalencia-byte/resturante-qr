# Cierre por anulación superada o calendario no vigente — r64

## Estado verificado y plan

2026-11-06. PR #389 abierto y no fusionado; base feature/finanzas-personales, SHA 652126a03f19fbec3c529cad1e84bff11cd3699e. Integración integration/fp-hormiga-clasificacion-credito-v81; padre real 6d9aee718dee4837a2a6bf07bd44bdb438c7977a, árbol 90407e7d271fbe426dc1270222d775ddeece566e. Gate 42237501109, Seguridad 42237500745 y V81 42237500649 del padre satisfactorios. #407 sigue abierto.

Un bloque funcional: cerrar expresamente solicitudes de restauración que ya no proceden por anulación superada o calendario no vigente. Añade causas precisas al evento y recibo, validadas por servidor y cliente, conservando solicitud e historia. No transforma un error HTTP o un 404 en evidencia de no aplicación.

## Criterios de aceptación

- La última compensación verificada del movimiento determina si la anulación solicitada sigue vigente. Si existe esa anulación histórica pero fue reemplazada, causa ANULACION_SUPERADA. La existencia de la anulación, integridad de fuente y cadena y ausencia de aplicación de la misma clave se verifican antes de certificar cierre.
- Con anulación vigente, un préstamo fuera de ACTIVO/VENCIDO, fecha no verificable, cuota no positiva/entera, periodicidad no admitida o no confirmada, o día de pago inválido produce CALENDARIO_NO_VIGENTE. Con calendario vigente, se mantiene CONTEXTO_CAMBIO para revisión/contexto/decisión modificados. Solicitud todavía vigente se rechaza sin aplicar ni cerrar.
- Estas causas se registran en evento firmado INSERT-only y solo pueden pertenecer a cierre de restauración. La verificación rechaza usarlas como no aplicación ordinaria de imputación. Modelos/validador conservan compatibilidad con eventos antiguos; no cambia el payload firmado antiguo ni se reescribe historia.
- El recibo conserva la causa registrada incluso si después se confirma calendario o se produce otra restauración con nueva clave. No se recalcula la causa desde el estado actual al consultar. No certifica saldo ni estado actuales; afectaCaja=false y compensacionHash=null.
- Pantalla ofrece “Cerrar sin aplicar si ya no procede”, consulta primero recibo y pide confirmación explícita con la misma clave/cuerpo. Control solo acepta las tres causas de cierre admitidas, vinculadas a propietario/ruta/cuerpo/anulación/hashes. Diario conserva NO_APLICADA y muestra la causa comprensible sin borrar solicitud ni emitir nuevo pago.
- Cierre mantiene intactos caja, capital, fuente y eventos financieros. GET y replay no escriben; la clave cerrada no vuelve a aplicar. Para restaurar más adelante se exige anulación vigente, calendario confirmado, lectura/revisión actual y clave nueva, pasando todas las condiciones financieras anteriores.

## Pruebas y evidencia

Pruebas puras y DOM añadidas en restauracionCicloPago.test.js y recuperacionInterfaz.test.js: prioridad de causas, estado/calendario inválidos, conservación de entradas y motivo del recibo, firma y rechazo del motivo reservado en imputación ordinaria. Regresiones de restauración positiva, rechazo, almacenamiento, sesión y recibos se conservan. Local: módulo 613 casos, 604 aprobados, 9 omitidos; CI personal 338/334/4, cero fallos. Dirigidas/versiones 31/31. Sintaxis de servicios, controles, interfaz y fixture y git diff --check satisfactorios. CI exacta publicada pendiente.

Ensayo autorizado nuevo, integrado en privilegiosLedgerMongoV81.integration.test.js: helper probarCausasCierre recorre servicios/handler/control/interfaz con Mongo real para ambas causas. Simula solicitud inicial sin respuesta, reemplaza anulación mediante restauración y nueva anulación reales o retira fecha/confirmación mediante corrección auditada; prueba bloqueo del reenvío normal, cierre, aislamiento de propietario, preservación financiera, replay concurrente y GET sin escrituras, reposición de calendario y restauración con nueva clave. Compara originales íntegros y conserva el recibo histórico tras restaurar. Solo el CI del SHA publicado puede acreditar su ejecución real.

No se crean colecciones/índices/servicios ni se amplían roles: siguen 21 historiales protegidos y respaldo V19 de 39 colecciones. Nuevos valores del enum son aditivos; no necesitan backfill ni borrado de usuarios.

## Límites y siguiente paso

Fuente adulterada/no verificable, ausencia de anulación demostrable, falta de índices/clave de firma y demás errores no producen certificado de cierre; se conserva incertidumbre. Ensayos sintéticos no acreditan custodia independiente, roles/índices de producción ni RPO/RTO operativo. No hay nueva aprobación visual de navegador/dispositivos en este lote.

Siguiente: cerrar la revisión de contratos de recuperación con una matriz de aceptación consolidada y priorizar los flujos funcionales aún abiertos en documentación; no añadir variantes sin defecto o requisito demostrado. Mantener #407 abierto hasta evidencia real de custodia/revisión independiente, acceso/retención de respaldo, restauración aislada y operación/compatibilidad/dispositivos. Sin merge a feature ni Render hasta cumplir todos los criterios. No se modifican main, Empresarial, Blushéa, datos reales ni costos.


## Cierre funcional verificado r64
SHA funcional d813766ec39aae542e83a5a133d374bc7e2d7725; árbol 4323ef1c2bacf23bb5852852bd8d21e11ad2bc09. Gate 42246664579, Seguridad 42246664701 y V81 42246664344 satisfactorios. Mongo autorizado job 127990557373: 81/81, cero fallos y omisiones. El ensayo nuevo verifica ANULACION_SUPERADA y CALENDARIO_NO_VIGENTE en interfaz/handler/servicios, rechazo del reenvío normal, fuente/caja/capital/eventos preservados al cerrar, recibos históricos estables, aislamiento, replay concurrente y GET sin escrituras, y restauración posterior con anulación/lectura/clave actuales. Local módulo 613/604/9; CI personal 338/334/4; dirigidas/versiones 31/31; sintaxis y diff --check satisfactorios.
Backup V19 aislado: 39 colecciones, 5594 documentos, 3882946 bytes, captura 205 ms, restauración 993 ms y edad 1153 ms. custodiaIndependiente=false, rpoProduccion=false: no son métricas operativas de producción. El commit posterior solo conserva esta evidencia y también requiere CI exacta verde antes de entregar.
Siguiente paso recuperable: consolidar matriz de contratos/aceptación de recuperación y priorizar flujos funcionales restantes con evidencia; evitar nuevas variantes sin defecto o requisito probado. #407/custodia independiente/operación/dispositivos pendientes. No merge a feature ni despliegue en Render hasta completar todos los criterios. Main/Empresarial/Blushéa/datos reales sin cambios; sin servicios/costos nuevos.
