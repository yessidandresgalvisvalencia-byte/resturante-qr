# Evaluación verificable de obligaciones V81

## Plan, estado real y alcance

5 de noviembre de 2026, Colombia. HEAD real revisado `6aa6b7eecdc1a059b11af3cf1535c374a08a37dd`, árbol `5ea39a817a0cc85addab4c813748640082d4c4c5`. #389 abierto/no fusionado, integración personal con base feature/finanzas-personales `652126a03f19fbec3c529cad1e84bff11cd3699e`; #407 abierto. Padre con tres CI success: Gate 42146975114, Seguridad 42146975107, V81 42146975119, Mongo autorizado 72/72. Se revisaron instrucciones/checkpoint y servicios/pruebas de retiro, restauración y compensaciones de deuda/compromisos. No hay AGENTS.md adicional en este árbol.

La recuperación de pagos/cuotas ya tiene implementación y pruebas de concurrencia, secuencia, replay y rollback. No se cuenta ese trabajo existente como nuevo. Un bloque seleccionado por el riesgo encontrado al revisar la decisión posterior a recuperar una deuda: evaluación de obligaciones sobre Disponible Hoy verificable y alternativas explícitas. El escenario nativo incluye retiro/restauración de deuda sin fecha para comprobar que el bloqueo reaparece sin alterar caja.

## Hallazgos reproducidos en el padre

El blob original devolvió CUMPLIBLE con saldoRealConocido/proximoIngresoConocido true, disponible 100 y aptoParaDisponibleHoy=false, sin prueba de conciliación/corte. Una alternativa sin cumpleObligacion devolvió cumpleObligacion=true. La API aceptaba costos planos mientras el servicio buscaba objetos anidados; esos costos no se evaluaban como el contrato aparentaba. Además, el selector elegía por costo antes de filtrar viabilidad de pago actual y usaba suma Number sin rechazo explícito de desbordamiento.

La reproducción fue local y sintética, sin consultar ni modificar saldos reales. No acredita que un usuario haya actuado con esos resultados.

## Criterios de aceptación y contrato

- Una observación C2 usa exactamente el validador compartido de Disponible Hoy: saldo conciliado, corte consistente COP, prueba/fórmula/GMF coherentes, sin obligaciones pendientes y próximo ingreso con importe y fecha futura colombiana. Si falla, FALTAN_DATOS, calculo=null, recomendacion=null y ninguna alternativa monetaria. No se inventa un disponible alternativo.
- La entrada exige montoMinor entero seguro positivo, concepto sin controles y campos conocidos. Sin coerción, identidad del cuerpo, campos ignorados ni montos flotantes. Se valida antes de consultar fuentes. El endpoint emplea cuerpo estricto y dueño JWT, no el validador genérico que quitaba campos.
- Alternativas opcionales renegociar/reprogramar/sustituir: costoMinor y pagoAhoraMinor enteros seguros no negativos, consecuencia explícita y cumpleObligacion booleano explícito. Campos omitidos permiten informar alternativa desconocida, nunca suponer cumplimiento, pago o costo. Datos mal tipados/ajenos se rechazan 400.
- Costo total = importe base + costo declarado mediante BigInt; solo se devuelve entero seguro. Pago actual no puede exceder costo total. La selección primero filtra pago actual dentro del disponible y cumplimiento declarado true, luego compara costo y pago, sin float ni ordenar por cantidades ambiguas.
- Los campos planos previos costoRenegociarMinor/consecuenciaRenegociar y equivalentes continúan reconocidos como alternativa desconocida: faltan pago actual y cumplimiento, no se inventan. Mezclar contratos de una misma alternativa se rechaza. No se transforma automáticamente un costo antiguo en autorización.
- CONSERVAR solo compara el importe informado con el disponible libre; cumpleObligacion=null porque no verifica condiciones externas. CUMPLIBLE significa que cabe ese importe, no certifica la extinción de la obligación. No confirma que no estuviera ya reservado.
- Toda salida es soloLectura=true, afectaCaja=false, autorizaPago=false, ingresoGarantizado=false y obligacionYaReservada=NO_VERIFICADO. Una alternativa conocida indica DATOS_DECLARADOS_POR_USUARIO y confirmadaPorTercero=false. No es cotización, acuerdo ni asesoría externa certificada.
- Conversación y endpoint comparten evaluación; semáforo, hasta seis líneas y una sola acción. Se aclara incluir cargos/impuestos sin confirmar exenciones. No modifica la fórmula existente ni duplica reservas. El endpoint usa no-store y sanitiza fallos inesperados con 503, sin filtrar causas privadas ni fabricar evaluación.

## Validación del lote

Local Node24: 548 casos, 539 aprobados, nueve omitidos por servicios externos, cero fallos; 14 dirigidas aprobadas; sintaxis/diff correctos. Nuevas pruebas de estados normales/cero/máximo, pruebas de saldo discordantes, fecha/importe de ingreso, coerciones, campos ajenos, costo máximo/overflow, alternativa incumplida o incompleta, prioridad de caja, contrato anterior, dueño/corte, seis líneas y fallo de servicio sanitizado.

Escenario nuevo HTTP/Mongo autorizado pendiente de CI al preparar el lote: dos identidades y saldos conciliados distintos, API y conversación reales, alternativas completas/incompletas, entradas inválidas, decisión bloqueada con deuda sin fecha aunque próximo ingreso siga conocido; retiro y restauración explícitos de esa deuda hacen desaparecer/reaparecer el bloqueo; comparar snapshots de cuenta, deuda, fuentes, outbox y eventos antes/después de cada consulta. Las consultas no generan ingresos, pagos, reservas ni eventos.

Sin cambios en colecciones, índices, permisos, backfill, migraciones, anclas, credenciales ni backups. No se reescribe historial. Pruebas aisladas no acreditan permisos de producción, custodia o recuperación operativa.

## Checkpoint y límites de liberación

Tras CI exacta, revisar el contrato de obligaciones realmente reservadas/vinculadas y cómo presentarlo sin descontar dos veces ni afirmar cumplimiento. Mantener la revisión de recuperación de obligaciones ligadas a fuentes corregidas; no se implementa adopción masiva ni modificación de calendarios legacy en este bloque.

Verificar HEAD/#389/#407/instrucciones/pendientes/CI antes de retomar y publicar solo con expected_sha y force=false. Guardar SHA/árbol/workflows/resultados aquí y en CONTINUIDAD_V81.md; el cierre documental también debe aprobar CI exacta.

#407 sigue abierto por evidencia real pendiente: custodio independiente, backup durable completo/retención/acceso/credenciales separados, restauración operativa y RPO/RTO, roles/índices/históricos de producción, seguridad/exactitud/concurrencia/idempotencia/migración/aislamiento/recuperación y dispositivos/compatibilidad/informe final. La demora/fecha del servicio publicado continúa sin medición real suficiente. Sin merge a feature/main ni Render, otros productos, costos nuevos o datos reales modificados.
