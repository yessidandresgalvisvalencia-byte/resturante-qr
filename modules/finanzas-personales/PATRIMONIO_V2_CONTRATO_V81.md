# Patrimonio V2: contrato 3 sobre snapshot personal

Estado: desarrollo en la rama de integración personal; no acredita despliegue ni preparación para producción. `GET /patrimonio-v2` conserva la ruta y publica `versionContrato: 3`, `fuente: snapshot_personal_v81` y el estado de conocimiento. Los consumidores deben revisar `totalConocido` y no convertir `null` en cero. El cambio requiere validar compatibilidad de clientes antes de liberar.

| Campo | Fuente y significado |
| --- | --- |
| saldoLiquidoMinor | Caja del snapshot solo si todas las cuentas activas están conciliadas; null en otro caso |
| bienesNoLiquidosMinor | Bienes incluidos tras verificar originales, recibos y ciclos |
| activosMinor | Caja conciliada + bienes no líquidos, excluye inversiones; null si el total no es completo |
| inversionesMinor / capitalInvertidoMinor | Valores y capital declarados de posiciones activas, sin doble conteo de copias vinculadas ni conversión a caja |
| resultadoInversionesMinor | Diferencia declarada exacta, no rentabilidad realizada |
| cuentasPorCobrarMinor | Saldos registrados por cobrar; todavía no son caja |
| deudasMinor | Pasivos del snapshot personal; null si hay referencias históricas pendientes |
| patrimonioNetoMinor | Caja + bienes + inversiones + por cobrar − pasivos; null si falta caja conciliada o referencias por revisar |
| fondoEmergenciaObjetivoMeses | Configuración existente del perfil; null si no existe perfil, sin inventar seis meses |

`REGISTRADO` describe solo las fuentes registradas verificadas por el código; no acredita propiedad legal, precio de mercado, riqueza externa ni suficiencia para gastar. Una caja conciliada en cero es conocida y puede producir total cero; ausencia de caja conciliada produce `REQUIERE_CONCILIACION` y cantidades desconocidas.

`REQUIERE_REVISION_HISTORICA` conserva las referencias de fin_deudas_personales, fin_creditos y activos originales aún no incorporados. No se asocian por nombre/importe ni se suman junto a préstamos actuales: falta una decisión auditable sobre identidad y vigencia. Las referencias no representan necesariamente deudas distintas; una puede ser copia de otra. Se conservan IDs, fuente e importe registrado. Incluso referencias con saldo cero permanecen pendientes de esta revisión; no se borran para habilitar el total.

El saldo del perfil anterior queda visible como referencia con `incluidoEnCaja: false`. La conciliación actual de cuentas lo reemplaza como fuente de caja, sin modificarlo ni transferirlo. Retiros, restauraciones y compensaciones se verifican por el mismo snapshot que usa el panel. V2 no consulta solamente saldos originales ni rellena ausencias con cero.

La consulta conversacional de patrimonio consume este contrato, explica componentes en máximo seis líneas y una acción; no autoriza gasto con el patrimonio. Los errores 400/409/503/500 no devuelven totales alternativos ni detalles internos. Las otras intenciones conversacionales conservan su contrato y requieren revisión separada.

La lectura completa y sus referencias usan una transacción snapshot de solo lectura. Se acotan referencias a 500 por colección, un perfil, detección de excedentes y timeout de 5 s. No hay migración, reparación, actualización de historial ni escritura de saldos en este adaptador.

Respaldo V15 añade fin_deudas_personales, fin_usuarios_patrimonio y fin_personas, preservando el alcance previo de V14 y anteriores. Su ensayo BSON/índices en base aislada no acredita retención, acceso o custodia independiente durables de producción. Estos siguen bloqueados por #407 y el informe de liberación.
