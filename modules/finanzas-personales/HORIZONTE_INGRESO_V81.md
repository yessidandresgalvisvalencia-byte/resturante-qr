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
