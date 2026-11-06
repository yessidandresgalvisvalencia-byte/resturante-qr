# Asesor master y eventos futuros registrados — contrato 2

Dos bloques: el master deja de añadir saldos parciales a una respuesta y la proyección de 30/60/90 días usa sumas exactas y una sola vista MongoDB. No completa un presupuesto futuro ni una liquidación contractual de préstamos.

## Asesoría sin disponible alternativo

estadoConocido utiliza disponibleConversacionalPersonal.validar: exige saldo/obligaciones/horizonte/fecha/moneda/evidencia y coincidencia con cálculo C2. Un flag truthy, saldo verificado aislado o null no se convierte en disponible cero. Cero verificado conserva su condición roja/amarilla. armarRespuesta ya no interpola texto base no verificado ni formatea Number(null).

orientar conserva respuestas de las fuentes verificadas de Disponible Hoy, deuda, resumen y patrimonio contempladas por su contrato, sin consultar otro saldo y mezclar snapshots. Conserva también el resultado específico de gastoInteligente (incluido rechazo/precio faltante), sin reemplazarlo por un cupo genérico. Las respuestas genéricas de decisión/contexto que requieren información financiera usan la observación C2 común. No se autoriza una compra ni se recomienda cuota desde ese disponible. Las aclaraciones de identidad de deuda se mantienen.

El contexto solo acepta turnos del propietario cuando orientar recibe usuarioId. Selección de historial en procesar incluye ese propietario. La respuesta no cita importes/textos viejos como condiciones actuales; adjunta referencia histórica de ID/fecha. No reescribe turnos o recibos existentes. Se retira además una lectura Home cuyo resultado no se usaba antes de llamar al master. Consulta general sin decisión ni contexto conserva su ruta normal, sin lecturas financieras adicionales innecesarias.

## Proyección parcial exacta

analizar abre una transacción snapshot/primary con Home.obtenerEnSesion, calendarios activos, deudas propias activas/vencidas y referencias históricas necesarias. Consultas secuenciales, sesión compartida, límite verificable 500+1 por colección y maxTimeMS de cinco segundos por consulta. Conexión, apertura/lectura/commit/cierre fallidos no entregan ventanas parciales. No modifica fuentes. El corte financiero es explícito y se observan versiones vigentes del snapshot; no certifica reconstrucción histórica de versiones ni el timestamp interno de MongoDB.

proyectarVentanas requiere importes enteros positivos seguros y fechas Date/civiles colombianas/instantes con zona verificables, sin coerción de texto monetario o fechas null. Acumulados/tramos/netos usan BigInt; cada campo publicado exige rango seguro, incluso si un saldo final podría ocultar desbordes de componentes. Tramos (0,30], (30,60], (60,90] respecto al instante de corte no vuelven a sumar el mismo evento. Identidad repetida de evento se rechaza; no se deduplica por nombre o monto.

Los calendarios MENSUAL registrados producen eventos civiles con día original y ajuste al fin de mes. Cero/default de monto queda pendiente, no acredita ingreso de cero. Un calendario con sourceId histórico debe apuntar a transacción propia del tipo compatible; no se afirma que ese movimiento pasado garantice el futuro ni se copia su monto. Obligación con vínculo a préstamo debe ser propia, única, coherente en cuota/día (con ajuste de fin de mes si el día original está declarado). No se suma dos veces el calendario y el préstamo. Vínculos contradictorios/ajenos/huérfanos fallan sin corregir registros.

Para préstamos se considera **solo la próxima cuota registrada con fecha futura**, una vez. No se transforma cuota cero en principal total ni se infiere amortización, interés, comisiones, plazo restante o cuotas futuras desde el saldo. Vencimiento hoy/atrasado, cuota sin definir y fecha ausente quedan señalados como pendientes. La función antigua calendarioObligacion se conserva para revisar usos dinámicos/externos, pero ya no calcula eventos dentro de esta proyección.

saldoCondicionalMinor es null en analizar: faltan gasto variable y condiciones contractuales completas. netoEventosRegistradosMinor es solo ingresos programados menos pagos registrados, nunca dinero libre. El helper matemático puro permite un saldo condicional únicamente si el llamador declara explícitamente escenarioCompleto/saldoVerificado y aporta saldo exacto; ese flag no certifica evidencia ni se habilita en producción. autorizaGasto=false y completo=false siempre en esta consulta. No hay ingresos programados no equivale a ingresos reales/futuros cero.

C3 muestra tres tramos en hasta seis líneas, semáforo amarillo, pendientes y una acción. No presenta saldo futuro ni aprobación de compra. Error de lectura/datos/contrato devuelve PROYECCION_NO_VERIFICABLE, sin cifras parciales ni mensaje interno.

## Matriz de aceptación y compatibilidad

| Caso | Resultado |
| --- | --- |
| Evidencia incompleta, flag string, null o corte incorrecto | Disponible desconocido; sin $0 ficticio |
| Cero C2 verificado | Cero conocido y semáforo correspondiente, sin sustituirlo por desconocido |
| Deuda/rechazo de compra ya evaluados | Se conservan; no se mezclan con otro saldo observado después |
| Contexto ajeno o importe antiguo | No aparece como condición actual |
| Suma MAX_SAFE_INTEGER + 1, fracción o string | Rechazo sin redondear ni recortar |
| Frontera de día/mes, febrero y final exacto del tramo | Fecha civil y pertenencia única al tramo |
| Préstamo 100/cuota 10 más calendario vinculado 10 | Próxima cuota 10 una sola vez; no principal 100 ni cuotas adicionales inventadas |
| Cuota cero, fecha ausente o vencida/hoy | Pendiente explícito, sin obligación sustitutiva |
| Escritura de ingreso/cuota/calendario después de leer Home | Consulta conserva versión anterior completa; siguiente consulta observa las actualizaciones |
| Usuario distinto, fuente corrupta o más de 500 | Sin mezcla ni totales parciales; originales conservados |
| Fallo al cerrar sesión | No devuelve resultado financiero como verificado |

Clientes de proyección deben consumir contrato 2 y nullable saldoCondicionalMinor; no conviertan null a cero ni las ventanas parciales en presupuesto. Las respuestas recuperadas de copilot siguen siendo históricas; no se recalculan ni se reescriben sus recibos. No cambia modelo, índice, rol o formato de respaldo V17. La prueba de MongoDB usa credencial restringida y datos sintéticos; no certifica dispositivos, roles reales o aceptación de producción.

Quedan pendientes calendario activable/recuperable con confirmación, presupuesto contractual completo, obligaciones/progreso y demás fuentes. #407, custodio independiente, backup durable/retención/acceso/claves separados, restauración/RPO-RTO operativos, históricos/roles/índices reales, dispositivos/seguridad/compatibilidad/informe final siguen abiertos. Sin merge a feature, Render, costos o cambios/borrados/restauraciones de datos reales.
