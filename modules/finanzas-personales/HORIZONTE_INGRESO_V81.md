# Horizonte de ingreso y compra estricta V81

Ámbito: Finanzas Personales, integración de #389 sobre feature/finanzas-personales. Sin despliegue Render ni cambios de datos reales. Fecha de revisión: 5 de noviembre de 2026.

## Problema y comportamiento

Home antes saltaba al próximo mes desde la medianoche del día de ingreso y, sin calendario, copiaba fecha e importe de transacciones históricas recurrentes. Además podía publicar Disponible Hoy sin horizonte, aunque el asesor conversacional lo rechazara. La evaluación de compras comprobaba algunas banderas pero no la evidencia C2 completa.

Ahora un calendario activo de INGRESO/MENSUAL requiere propietario, identificador, concepto, día entero 1–31 e importe entero seguro positivo. Día 31 se ajusta al fin de cada mes preservando el día original. El corte es civil colombiano, independiente de TZ del servidor. Un ingreso previsto para hoy permanece pendiente durante todo ese día: no se presume recibido ni se salta al siguiente mes. No se utiliza el importe de un movimiento anterior como previsión nueva. Calendarios sin importe, con datos incoherentes, duplicados de identidad, referencias huérfanas/ajenas/incompatibles o excedidos no habilitan horizonte. Dos calendarios distintos con mismo concepto/monto no se deduplican: si vencen el mismo día se suman con BigInt y solo se publica un entero seguro; sus IDs quedan trazables.

La procedencia sourceId, si existe, se lee filtrada por propietario en la misma transacción snapshot de Home; no se copia su importe. El original histórico se conserva. No es prueba de que el ingreso vaya a llegar, de vigencia contractual ni de un pago recibido. La ausencia de sourceId sigue siendo compatible con el calendario legado; esta lectura no certifica su creación ni le inventa un recibo de confirmación.

Sin horizonte verificable: asesor.proximoIngreso=null, proximoIngresoConocido=false, Disponible Hoy y simulación GMF autorizados=null, aptoParaDisponibleHoy=false y motivos en ingresosPendientes. Caja, flujo realizado e históricos siguen visibles y no se convierten en cero. El fin de mes puede seguir sirviendo como corte interno para listar compromisos pendientes, pero no autoriza gasto. La respuesta señala que falta confirmar próximo ingreso.

La compra usa la misma validación C2 que Disponible Hoy: identidad de fuente, corte exacto, COP, saldo/decisión conciliados, obligaciones sin pendientes, aritmética coherente y fecha/importe futuros. No basta recibir banderas verdaderas con montos contradictorios. Datos parciales devuelven FALTAN_DATOS sin cupo/impacto; fallo de lectura se propaga sin evaluación. CABE/NO_CABE/REQUIERE_PLAN se conservan cuando la evidencia completa es válida. Las utilidades estrictas de fecha se separan en fechaPersonal.service.js; el módulo de gasto conserva sus exportaciones para consumidores actuales y carga el validador de compra al evaluar para evitar un ciclo de inicialización.

## Criterios delimitados y evidencia

| Criterio | Evidencia |
| --- | --- |
| Fecha colombiana, hoy, fin de mes, bisiesto y año | horizonteIngreso.test.js, incluidos procesos UTC/Tokyo/Los Ángeles |
| Importes exactos, identidad, referencias, límites, sin subtotales | Casos puros de desconocidos, 5001 fuentes, overflow BigInt y dos calendarios distintos |
| Compra coherente o rechazo sin cifras | Regresiones completas C2, corte, obligaciones y escenarios CABE/NO_CABE/REQUIERE_PLAN/crédito; fixtures anteriores se completan con evidencia real del contrato |
| Consulta integrada sin escrituras | Nuevo helper horizonteIngresoAutorizado en suite MongoDB autenticada; aún requiere CI exacta antes del cierre |
| Concurrencia y aislamiento | Fixture autenticado escribe calendario en otra sesión entre ledger y patrimonio; snapshot activo anterior, siguiente consulta pendiente; original/caja/outbox preservados por lecturas |
| Datos corruptos o referencia ausente | Fixture autenticado lee sin reparar ni borrar y rechaza cupo; suite aún pendiente hasta CI |

Validación local antes de publicar: módulo 464 casos, 455 aprobados, nueve integraciones omitidas, cero fallos. Veinticuatro dirigidos aprobados, sintaxis general y cuatro archivos nuevos correctos, diff correcto. Suite raíz y CI autenticada pendientes al escribir este registro; no se acreditan omisiones como aprobaciones.

## Compatibilidad y límites

No cambian modelos, índices, privilegios nativos ni respaldo V17. No se ejecutan migraciones ni limpiezas. Consumidores de Home deben aceptar null y nuevos motivos; una transacción histórica marcada recurrente ya no basta para habilitar Disponible Hoy. No se borra ni se cambia su recurrencia original. Los calendarios legados siguen mutables con los controles anteriores: su activación/corrección/retiro/restauración idempotentes con eventos auditables y confirmación de propietario constituyen el siguiente bloque, no una capacidad completada aquí. Confirmar ingresos de hoy requiere ese flujo explícito; la lectura no deduce recepción ni genera transacciones.

La prueba de lectura usa escrituras sintéticas explícitas exclusivamente en base aislada; no acredita custodia independiente ni recuperación de producción. #407, respaldo completo durable, retención, acceso/claves separados, custodio real, RPO/RTO y restauración operativos, roles/índices/históricos reales y aceptación integral de seguridad/dispositivos/compatibilidad/informe final permanecen pendientes. No hay certificación externa ni garantía absoluta.


## Cierre verificado del código

Código `8d756e1a8c165b5377f581bb5d3440073b611e57`: [Gate 42030643040](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42030643040), [Seguridad 42030642873](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42030642873) y [V81 42030642872](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42030642872) success; siete jobs V81 aprobados, 64 pruebas MongoDB autenticadas/cero fallos. Catorce archivos cotejados byte a byte contra GitHub. La prueba nueva acredita el bloque integrado y no escribe al consultar.

Un ingreso original recurrente recibido por 200 conserva flujo 200 y caja 1200 pero no habilita horizonte sin calendario. Calendario hoy y otro futuro no permiten saltar el primero. Tras desactivar explícitamente el de hoy solo en fixture, previsión 500 vinculada al original sigue siendo 500, no copia sus 200 ni el monto 999999 del otro usuario; Disponible Hoy 1080, compra 100 CABE y 1100 NO_CABE. Cambio externo de calendario a hoy/700 entre ledger y patrimonio conserva resultado anterior en la consulta activa; la siguiente queda pendiente. Huérfano, fracción monetaria y día fraccionario bloquean sin reparación. Original, cuentas, outbox y calendarios se mantienen por leer.

La regresión personal antigua de Home se completó con calendario identificado, propietario, estado, frecuencia y comprobación real de ObjectId. Diecinueve dirigidos posteriores aprobaron. La suite raíz local había registrado 65 fallos: uno fue ese fixture corregido, los otros 64 requieren TEST_MONGO_URI empresarial ausente localmente. No se tocaron pruebas empresariales; Gate con su entorno configurado aprobó el SHA del código. Las nueve omisiones locales no se cuentan como aprobadas.

Respaldo V17 en ensayo de CI: 37 colecciones/5325 documentos/3448434 bytes, captura 205 ms, restauración 997 ms, edad 1158 ms; custodiaIndependiente=false y rpoProduccion=false. No es evidencia de respaldo durable, custodio real, retención ni restauración/RPO/RTO operativos.

El calendario mensual legado define una regla, no un registro completo de recepción de cada ocurrencia: pasada una fecha civil, la próxima recurrencia vuelve a calcularse; esto no certifica que la anterior se haya cobrado. Una vez exista activación/gestión por eventos, debe conservarse recepción pendiente y requerir confirmación explícita para cambiar la próxima ocurrencia. No se introduce esa escritura silenciosamente en esta consulta. Tampoco se completa vigencia contractual o monto garantizado. El siguiente commit solo conserva este cierre y requiere CI exacta antes de retomar.
