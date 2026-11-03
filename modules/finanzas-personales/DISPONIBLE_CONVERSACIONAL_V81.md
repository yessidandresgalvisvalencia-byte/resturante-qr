# Disponible Hoy conversacional: contrato de lectura estricta

Estado: desarrollo en integración personal, sin despliegue. /consulta usa disponibleConversacionalPersonal.service para DISPONIBLE_HOY y META_INGRESOS_PARA_GASTAR. No registra ingresos, pagos, metas ni movimientos. No usa datos locales para suplir un fallo del servidor.

La autorización requiere señales booleanas explícitas del asesor: saldo conocido/VERIFICADO, sin conciliación pendiente, aptoParaDisponibleHoy y caja conciliada. Deben existir y estar vacías las listas de obligaciones sin fecha, gastos de hoy sin conciliar, vencimientos atrasados y cuotas sin definir. La ausencia de una lista no equivale a una lista vacía.

El próximo ingreso necesita importe entero positivo y fecha civil colombiana o instante con zona explícita válido, en un día colombiano posterior al corte. Se reutiliza el parser ya validado de gasto inteligente; no se normalizan fechas imposibles, valores null/números/arrays ni horas sin zona. Ingreso previsto no es saldo recibido ni garantía de llegada.

Se contrastan importes enteros seguros no negativos, colchón, disponible, condición roja y simulación GMF contra las mismas funciones determinísticas exportadas por Home. También se exige hecho de saldo verificado y decisión de gasto de alta confianza, con fuente/importes y corte correspondientes a la misma consulta. Esta comprobación valida la coherencia de la respuesta de Home; no inventa un cálculo alternativo ni un horizonte cuando falla.

| Estado | Respuesta y datos |
| --- | --- |
| Autorizado con margen | Disponible en salidas totales, componentes registrados, fecha prevista y escenario 4×1.000 condicional. Hasta seis líneas, una acción |
| Autorizado en rojo | Disponible cero conocido y brecha actual exacta; orden de no hacer gasto discrecional. No convierte la brecha en meta de ingreso |
| Autorizado sin margen | Cero conocido distinguido de ausencia, sin sugerir gasto |
| No verificable | aptoParaDisponibleHoy=false y disponibleHoyMinor=null, motivo y una acción; no publica un cupo alternativo ni cantidades no verificadas |
| Servicio no disponible | Mensaje genérico sin detalles internos, sin cifras de otra consulta y sin autorización |
| Meta de ingresos | ingresoObjetivoMinor=null. Explica límite registrado o brecha actual, pero exige objetivo/fecha antes de crear una meta; nuevos ingresos, gastos e impuestos cambiarían el cálculo |

El GMF es un escenario de salida total gravada: no acredita exención, cobro efectivo ni que el importe completo disponible pueda destinarse al precio de una compra. Gasto máximo y reserva se presentan separados. La capa de explicación no suma dinero; consume valores validados por C2 y formatea español colombiano.

La consulta usa el dueño de la sesión y obtiene Home de nuevo con un corte propio. Rechaza un corte discordante; una excepción no se convierte en saldo cero ni usa la respuesta anterior. Las validaciones anteriores de gasto inteligente y sus casos normales/fallos se conservan; solo se reutilizan sus utilidades de fecha.

Respaldo V16 incorpora fin_calendario_financiero y mantiene los 33 nombres originales de V15 en su posición. Preserva documentos e índices en ensayo aislado; no acredita una copia durable independiente de producción ni RPO/RTO reales.

Límites pendientes: Home todavía debe acreditar la consistencia global entre todas sus lecturas MongoDB frente a escritores concurrentes; esta validación no crea una transacción global para ellas. También quedan por revisar otras intenciones de consulta, la clasificación de /consulta como lectura financiera en el control de pendientes del cliente, históricos, dispositivos y operación real. La evidencia/corte de esta respuesta no autoriza otra operación futura ni sustituye sus validaciones atómicas. No liberar en Render hasta resolver los gates de #407 y la aceptación integral.
