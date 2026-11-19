# Contexto de captura conversacional — r102

19 de noviembre de2026 (Colombia). Base remota comprobada aea2ada4e9faba2517aba24bab9960834952b3db, árbol fffb510e5b6a6b4cc76f2fa25003be8e06a48763. PR389 abierto hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e; Gate44503763686/Seguridad44503763814/V8144503763725 success. #407 abierto. La revisión de fechas/condiciones de compra ya tiene evidencia en HORIZONTE_INGRESO_V81.md y EVALUACION_OBLIGACIONES_VERIFICADA_V81.md; no se repite como bloque nuevo.

## Bloque y plan

Un bloque funcional: conservar contexto minimizado de la solicitud HTTP /copilot junto a su recibo original, verificarlo al recuperar y explicar su alcance sin aprobar movimientos ni crear caja.

1. Dominio FP_CAPTURA_CTX_MIN_V1 con la infraestructura contextual existente: clave dedicada independiente de autenticación/datos, HMAC por dominio/dueño/día/peer del socket, ignorando XFF. User-Agent reducido a familia/navegador declarados no verificados. El handler pasa un capturador del servidor, nunca del cuerpo. Se difiere hasta después del replay y antes del clasificador: una captura nueva sin configuración válida falla503 sin crear borrador, turno, contexto conversacional ni recibo. Llamadas internas declaran INTERNO_SIN_RED, sin inventar conexión.
2. Campo privado opcional/select:false auditoriaContexto en la colección INSERT-only de capturas; serialización normal lo excluye. El hash del recibo agrega el compromiso del contexto únicamente si existe. Vector calculado con el algoritmo previo debe conservarse; no se modifica ninguna captura antigua, texto, turno, resultado ni hash anterior. Alteración, contexto parcial/ajeno/de otro dominio o DTO público usado como privado bloquean la verificación.
3. Captura del contexto, clasificación/borrador, turno y recibo mantienen la misma transacción. No se copia contexto privado a turno/borrador/contexto conversacional/resultado. Consultar y repetir una misma clave verifican original/fuentes antes de responder; no requieren clave contextual actual ni recapturan. Rotación de clave afecta solo capturas nuevas. Clave igual con texto/canal distinto sigue rechazada.
4. Respuesta por whitelist existente: resultado original más recibo con resumen público y compromiso; jamás token, IP o ID de clave. El diario admite la pareja resumen/compromiso estrictamente, rechaza campos privados/adicionales y conserva recibos viejos sin contexto. Copias/archivo/recuperación siguen conservando el recibo exacto; consulta histórica no actualiza consejo o saldos. El visor muestra fecha observada/dispositivo declarado no verificado y aclara que capturar no aprueba ni acredita dinero recibido.
5. El instante observado precede al procesamiento y puede diferir de fecha del recibo/commit. No acredita cuándo ocurrió el hecho relatado, autoría material, cliente/dispositivo real, saldo bancario ni aprobación. Hash/compromiso son consistencia local: no custodia independiente ni verificación autónoma completa desde el resumen público. El texto y resultado original pueden contener datos financieros aportados por su dueño; esto no es anonimización de la conversación.
6. RespaldoV30/44 compatible V29 y anteriores, mismas25 colecciones protegidas/roles/índices. No migración, nuevas colecciones, TTL, limpieza, backfill ni borrado/restauración productivos. Publicar con HEAD esperado y árbol idéntico, comprobar tres CI exactas, registrar cierre/métricas/siguiente paso.

## Criterios de aceptación

| Criterio | Evidencia requerida |
| --- | --- |
| Origen/privacidad | HTTP del servidor/dueño JWT, peer no XFF/dominio independiente; forja/configuración ausente rechazadas sin efectos; respuesta/serialización/turno/borrador sin token/IP/ID de clave |
| Originales/compatibilidad | Vector hash previo idéntico, legado legible sin contexto inventado; BSON/solicitud/texto/canal/resultados anteriores preservados |
| Atomicidad/idempotencia | Carrera crea un recibo/turno/borrador; fallo después de INSERT revierte todo; cero movimientos/cuentas/outbox por capturar |
| Recuperación/integridad | GET/replay sin clave contextual actual no escriben; rotación conserva anterior; contexto alterado bloquea lectura/replay sin reparar; dueño ajeno404 |
| Interfaz integrada | Login/HTML/API/Mongo autorizado, acuse perdido, un POST y consulta GET, diario exacto y resumen no verificado visibles390; sin aprobación ni repetición de efectos |
| Evidencia recuperable | Pruebas normales/fallos, SHA/tree/CI, métricas aisladas/límites, plan/matriz/continuidad y siguiente paso versionados |

## Validación previa a publicar

Local: módulo905 casos/896 aprobados/9 omisiones/0 fallos; ci:personal353/349 aprobados/4 omisiones/0 fallos. Dirigidas de captura/copia/archivo/respaldo61/61 y contexto/visor8/8; se solapan, no sumarlas. Sintaxis helper Mongo/harness correcta. Mongo autorizado y Chromium nuevos pendientes de CI del SHA publicado; omisiones locales no sustituyen integración. Sin cambiar timeouts ni omitir gates. El caso de navegador se sitúa en Inicio, donde está el flujo real de captura.

## Límites, liberación y siguiente paso

Select:false/transform/DTO son controles de aplicación, no cifrado ni permisos Mongo por campo. Un administrador con reescritura coherente de recibo/contexto/fuentes sigue fuera de la evidencia local; custodio independiente real pendiente. No se certifica que la IA clasifique correctamente cualquier texto ni que el usuario haya aprobado un borrador. La aprobación financiera y sus otros productores/contextos siguen pendientes en su alcance.

Clientes/recursos personales se versionan juntos como20261119-contexto-captura-v81. Clientes antiguos con whitelist previa pueden conservar la operación pendiente hasta actualizar; no borrar sus diarios ni reenviar automáticamente para resolver compatibilidad. Debe validarse publicación conjunta y recuperación con el cliente real antes de liberar. El ensayo de copia no garantiza durabilidad física de un navegador.

Persisten #407 y matriz integral: custodia independiente real; respaldo independiente/retención/acceso y restauración operacional aislada con RPO/RTO; roles/índices/compatibilidad históricos productivos; claves/proxy/rate limit reales; Safari/dispositivos físicos y auditoría independiente aplicable. Backup sintético no acredita recuperación/retención productiva. Sin merge a feature/main, sin Render/Empresarial/Blushéa, costos o datos reales modificados.

Siguiente: confirmar CI exacta y cerrar evidencia; después contexto de aprobación IA/deuda/crédito y resolución explícita de metas ambiguas por eventos/consentimiento, preservando fuentes. Releer HEAD/PR389/#407/CI, este informe, matriz y continuidad antes de actuar. Tarea activa; GitHub publicado no equivale a Render desplegado/verificado.


## Cierre verificado r102 — 19 de noviembre de2026

Un bloque funcional completado en el alcance descrito: contexto minimizado de captura /copilot ligado al recibo original, privado en servidor y resumido para recuperar/explicar, sin aprobar ni registrar finanzas. Código ec7b6a7854182c156ef3f900ff290c13ea9b6908, árbol bc1390362eb8289c88773db4620d6bd5f266ab72, sobre aea2ada4e9faba2517aba24bab9960834952b3db. Publicación con lease sin forzar historia y árboles local/remoto idénticos.

| Evidencia del SHA funcional | Resultado observado |
| --- | --- |
| [Gate44538037464](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44538037464) | success |
| [Seguridad44538037158](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44538037158) | success |
| [V8144538037163](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44538037163) | success, ocho jobs aprobados |
| [Mongo autorizado/Chromium135608600763](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/44538037163/job/135608600763) | Mongo95/95 y navegador/backend30/30, cero fallos, cancelaciones u omisiones |

Criterios de origen/privacidad, compatibilidad, atomicidad e integridad/recuperación verificados en su alcance: forja400/configuración ausente503 sin efectos; HMAC por peer127.0.0.1 ignorando XFF falso y dominio distinto del registro; serialización/consultas/API sin privado; carrera misma clave produce un recibo/turno/borrador; fallo después del INSERT revierte todo; GET/replay sin clave contextual actual conservan snapshot; rotación conserva contexto anterior; hash legado conserva vector y BSON previo; alteración bloquea lectura/replay409 sin reparación; ajeno404. Capturar no crea cuentas/transacciones/outbox financieros en los casos ensayados.

Interfaz real: FP_CONTEXTO_CAPTURA confirma login/Chromium390, un POST y una consulta de recibo tras respuesta perdida, lectura sin clave, solicitud literal original, turno/borrador/contexto intactos, cero aprobaciones y cero movimientos financieros. El diario confirma únicamente el recibo propio y muestra dispositivo declarado no verificado, aclarando que no acredita aprobación ni dinero. Las pruebas existentes de copia/archivo y recuperación de capturas también aprobaron con el formato extendido. No representa Safari/dispositivo físico ni exactitud universal del clasificador.

BackupV30/44 del mismo job:7892 documentos,7809746 bytes, captura366ms, restauración1166ms, edad1432ms; BSON/índices verificados en destino aislado vacío. custodiaIndependiente=false y rpoProduccion=false: no RPO/RTO, retención o recuperación operativa productivos. Mismo rol/índices/colecciones y sin migración. Local905 casos/896aprobados/9omisiones y ci:personal353/349aprobados/4omisiones, cero fallos; dirigidas61/61 y contexto/visor8/8 solapadas. Omisiones locales no sustituyen CI autorizada ni aceptación de producción.

Informe/matriz/continuidad versionados. El descendiente documental debe comprobar sus propias tres CI y se identifica con SHA/resultados en GitHub/PR; no se le atribuye de antemano la CI del código. PR389 sigue abierto; feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e sin merge. #407 y bloqueos operacionales de la matriz permanecen: custodia independiente real, respaldo/retención/acceso y restauración operativa con métricas reales, roles/índices/compatibilidad históricos productivos, configuración real de claves/proxy/rate limit, dispositivos y auditoría independiente aplicable. Sin Render, main, Empresarial, Blushéa, costos ni datos reales modificados.

Checkpoint siguiente: releer HEAD/PR389/#407/CI y CONTEXTO_AUDITORIA_CAPTURA_PERSONAL_V81.md, MATRIZ_ACEPTACION_PERSONAL_V81.md, CONTINUIDAD_V81.md. Continuar con contexto de aprobación IA/deuda/crédito y resolución explícita de metas ambiguas mediante eventos/consentimiento, preservando fuentes. No reutilizar este contexto de captura para afirmar aprobación posterior; son actos distintos y deben observarse separadamente. Tarea activa. GitHub publicado, Render no desplegado/verificado.
