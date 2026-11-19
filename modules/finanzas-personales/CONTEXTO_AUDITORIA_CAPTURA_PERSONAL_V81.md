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
