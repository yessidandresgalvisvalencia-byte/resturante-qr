# Home: una vista de lectura MongoDB

Home.obtener conserva la API y el contrato financiero. Abre una sesión y una transacción con readConcern snapshot y readPreference primary. Consulta secuencialmente el flujo compensado, préstamos, tarjetas, snapshot patrimonial, ingresos recurrentes, calendario, cobros, gastos recurrentes y pagos vinculados del ciclo. Las consultas directas reciben la misma sesión; consultarPeriodo reutiliza esa transacción y snapshotEnSesion no crea otra.

La primera lectura fija la vista de la base para todas las demás. Un ingreso o una compensación confirmados en otra sesión después de esa lectura no aparecen a medias. Una consulta posterior puede observarlos completos. No se bloquean escritores ni se escribe un cursor, recibo o dato financiero para consultar Home.

El corte temporal se captura una vez y se copia en cada intento: define filtros y fechas civiles de Colombia. No identifica el timestamp interno de commit de MongoDB y no constituye una consulta histórica de versiones anteriores de documentos. Una actualización posterior al corte pero anterior a la primera lectura puede pertenecer a la vista. No usar la respuesta como autorización para una operación monetaria futura; esa operación debe conservar sus validaciones y transacción propias.

| Aceptación | Verificación |
| --- | --- |
| Una sesión, sin consultas paralelas | Prueba aislada exige identidad de sesión en cada consulta, pagos recurrentes incluidos; no invoca snapshot independiente |
| Fallo cerrado | Entrada/fecha inválidas y conexión desconectada rechazan antes de abrir. Error de apertura, lectura, confirmación o cierre no entrega un panel parcial ni saldo cero de reemplazo |
| Reintentos | El callback recompone toda la respuesta, sin acumuladores externos ni efectos duplicados; sesión cerrada una vez |
| Concurrencia real | CI autenticada confirma ingreso y cambios de cuota/calendario durante Home: la respuesta conserva la vista previa y la siguiente muestra el nuevo estado completo |
| Compensaciones | Corrección concurrente conserva flujo/caja de la misma vista; nueva lectura aplica ambos efectos y conserva el asiento original |
| Integración | Disponible conversacional consume el nuevo Home sin cambiar fórmulas, verdad, conciliación, límites de listas, índices o roles |
| Solo lectura y aislamiento | Fotos de cuentas, calendario, préstamos, transacciones y outbox antes/después; otro propietario no recibe las fuentes del usuario |

Se mantienen los límites de 5.000 listados directos, límites más estrictos del snapshot patrimonial y maxTimeMS de cinco segundos por consulta. No se garantiza latencia total ni carga instantánea: secuenciar operaciones puede aumentar el tiempo frente a Promise.all; medir en infraestructura personal antes de liberar. El replica set y las transacciones ya eran requisitos del módulo. Si la infraestructura no los admite no se degrada a lecturas independientes.

Límites adicionales: la vista única no demuestra completitud de fuentes históricas ni corrige por sí sola su identidad, semántica de recurrencias o fechas no confirmadas. No acredita índices/roles de producción, custodia independiente ni recuperación real. El control de /consulta frente a pendientes se detalla en CONSULTAS_PENDIENTES_V81.md. Quedan otras intenciones conversacionales, históricos, seguridad/dispositivos/compatibilidad y gates de #407. Sin despliegue parcial ni cambios de datos reales.
