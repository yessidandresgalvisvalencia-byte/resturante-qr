# Diario manual recuperable por propietario — r70

## Estado de partida y plan
HEAD comprobado 255a4eb5e96ac57f8a3a538ed418753824cd2c30, árbol a09402b473dd6b38b3e75d61e07b26cf78e0b888. PR #389 abierto sobre feature/finanzas-personales SHA 652126a03f19fbec3c529cad1e84bff11cd3699e. #407 abierto; Gate 43158846881, Seguridad 43158846886 y V81 43158847186 verdes. Instrucciones, README raíz/personal y continuidad revisados; sin AGENTS.md local. Próximo ingreso/compra estricta ya resueltos, no se repiten. Se retomó preparación local no publicada comprobando HEAD nuevamente; una sola sesión publica con lease.

Defecto previo versionado/reproducido: limpiarIntentoManual eliminaba grukPersonalIntentoManualV1 al salir; ese registro solo tenía clave/huella vinculada al JWT y no conservaba cuerpo. La cuenta siguiente podía mantener campos privados del formulario. Un bloque: conservar solicitud exacta por propietario antes de enviar, recuperar mediante consulta explícita y aislar vista al salir/cambiar de cuenta.

## Criterios y comportamiento
| Caso | Resultado exigido |
| --- | --- |
| Antes de POST | Guardar cuerpo completo, UUID e integridad en gruk.fp.manual.v81:<usuario>; fallo de almacenamiento impide enviar |
| Respuesta perdida/401/logout | Conservar entrada PENDIENTE, cuerpo y clave; limpiar vista y campos privados sin borrar diario |
| Nuevo JWT del mismo usuario | Recuperar su entrada mediante identidad estable; nunca reenviar al entrar |
| Otra cuenta | Vista vacía de diarios ajenos; propietario financiero se sigue obteniendo del JWT verificado en backend |
| Consulta explícita | POST confirmar-intento es consulta transaccional de lectura; confirmar solo con confirmado/existe/ACTIVA/transaccionId válidos y mismo cuerpo/clave |
| Reenvío explícito | Primero consultar; solo resultado negativo verificable y confirmación humana permiten el mismo POST/cuerpo/UUID; consultar después, no confiar en ok genérico |
| Fuente anulada/corregida | Conservar pendiente y explicar; no reenviar automáticamente ni prometer estado actual |
| Recibo | Conservar solicitud original y respuesta de confirmación; finalización idempotente; aviso de que no certifica saldo/estado actual |
| Entrada corrupta o callback viejo | Falla cerrada, sin borrar, finalizar en otra cuenta ni enviar; digest tardío no escribe clave |
| Legado sin dueño | Conservar bytes y bloquear nuevos envíos manuales con aviso; no adoptar ni borrar automáticamente |

public/finanzas-personales-manual.js implementa diario y panel. El formulario existente usa preparar antes del POST y confirma contra la fuente antes de marcar el diario; clearToken/enter solo limpian memoria/vista. Se cargan script/versiones conjuntamente y el navegador sintético sirve el nuevo recurso. No se cambian servicios financieros, fuentes, índices, permisos ni migraciones.

La validación local exige cuerpo permitido, UUID, fecha civil válida no futura al preparar e importe entero positivo seguro; rechaza efectivo/transferencia incoherentes y gasto a crédito (flujo separado), evitando una normalización silenciosa que impediría comparar el reintento. SHA256 detecta corrupción accidental del cuerpo local; no es firma ni defensa contra un atacante con escritura de almacenamiento. Backend conserva autorización y cotejo de todos los campos originales.

## Evidencia inicial
Local: módulo 627/618/9; CI personal 347/343/4, cero fallos. Once contratos de diario cubren cuerpo completo, JWT renovado, aislamiento, legado, confirmación genérica rechazada, idempotencia, corrupción/cuota de almacenamiento, importes/fechas inválidos, digest tardío, cancelación de reenvío y consulta tardía. Se trasladó prueba de digest al diario real; no se omitió su comportamiento. Sintaxis y diff --check satisfactorios. Integraciones omitidas localmente requieren CI exacta, pendiente hasta publicarla.

MOVIMIENTO_MANUAL_EN_VUELO_CAMBIO_SESION amplía el ensayo real existente: commit antes de respuesta retenida, 401/cambio de cuenta, diario con cuerpo íntegro, logout/login del propietario con JWT nuevo, botón Consultar movimiento guardado, entrada CONFIRMADA con mismo cuerpo/UUID y recibo; un único POST financiero y snapshots sin efectos adicionales. El cuerpo se recupera de la aplicación, no solo del harness. Chromium/HTTP/JWT/Mongo reales de ensayo aislado; sin datos reales.

## Límites y siguiente paso
sessionStorage conserva esta pestaña y sus recargas; no acredita cierre definitivo de pestaña, pérdida del navegador, copias independientes ni otro dispositivo. Datos locales legibles por scripts del mismo origen; no son una frontera de autorización ni una copia cifrada independiente. Límite de 100 entradas por propietario, sin poda automática; alcanzar capacidad bloquea nuevas altas para no perder originales. Históricos anulados/corregidos requieren revisión, no se cierran como confirmados.

El legado global no contiene propietario/cuerpo verificables suficientes para adopción automática. Siguiente: diseñar y verificar recuperación explícita del legado con prueba de titularidad contra fuente y preservación del original; revisar resolución de histórico anulado/corregido y capacidad del diario sin limpieza automática. No atribuir dueño ni inventar cuerpo/ingreso. Estos límites siguen pendientes antes de liberar recuperación integral.

#407, custodio independiente real, backup separado protegido/retención/restauración operacional con RPO/RTO, roles/índices/credenciales productivos, auditoría independiente cuando aplique y dispositivos/compatibilidad operativa pendientes. Sin merge a feature ni Render; sin modificaciones de main/Empresarial/Blushéa/datos reales ni planes/servicios nuevos. No certificación externa ni recuperación garantizada.


## Integración y bloqueo de asesoría pendiente
SHA 7f10e3abe3e7b1b9febcd627f71a83480c4b1a92, árbol 1ae9459b8763ddaad0ae8bfd523053a43ed6311a: Gate 43171505278, Seguridad 43171505282 y V81 43171505297 verdes. Job 131025640505: Mongo autorizado 81/81 y navegador/backend 5/5, sin fallos/cancelaciones/omisiones; FP_MANUAL_EN_VUELO acredita cuerpoCompletoRecuperado y diarioPorUsuario junto a fuente única y confirmación sin escrituras. Se recuperó el cuerpo desde sessionStorage de la aplicación tras logout/login y JWT renovado; no desde un cuerpo inventado en el harness.
Se integra además api.estadoFinanciero con el diario: un pendiente o legado conserva bloqueo de asesoría aunque el control genérico ya haya resuelto el POST. JSON ilegible falla cerrado. La prueba ejecuta el wrapper real: control genérico libre + diario pendiente => bloqueado; confirmación verificable => libre; almacenamiento corrupto => bloqueado. Local módulo 627/618/9, CI personal 348/344/4, cero fallos; doce contratos del diario. El descendiente exige CI exacta propia. Legado, histórico anulado/corregido, capacidad, sessionStorage y gates operativos conservan sus límites. Sin merge ni Render.
