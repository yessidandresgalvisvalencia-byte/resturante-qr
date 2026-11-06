# Ingreso mensual conversacional y preparación de copilot

Dos bloques delimitados: vista previa mensual sin inferir ingresos y clasificación de POST /copilot fuera de operaciones monetarias inciertas. No implementa activación de calendario ni recuperación idempotente de turnos/borradores; siguen pendientes como flujos separados antes de producción.

## Vista previa de ingreso mensual

El servicio puro reconoce declaraciones que empiezan por «me pagan/consignan/depositan», «recibo» o «cobro», incluyen «cada mes» y un único «el [día] N». La frase «me pagan el 15» no confirma una periodicidad mensual. Preguntas, hechos pasados, días múltiples o inválidos no producen una programación. Monto opcional declarado con «por» o «monto de», entero COP seguro, agrupación con puntos y unidades mil/luca/palo. Calcula importe con BigInt antes de convertir al entero COP seguro; rechaza fracciones, exponentes, cero, exceso y múltiples importes. Ausencia de monto devuelve null; no consulta ni copia el último ingreso ni crea uno nuevo.

Fecha tentativa usa partes civiles de America/Bogota y funciones compartidas de Home, independiente del TZ del servidor. Ajusta el día 31 al fin de febrero/mes corto y conserva la regla original. Si ese día ya pasó, muestra el mes siguiente; si ocurre hoy, conserva hoy y exige aclarar si se recibió o cuál es la próxima fecha: no lo salta por suposición ni habilita Disponible Hoy. Fecha tentativa no se presenta como próximo ingreso confirmado.

El contrato devuelve clase INTENCION, requiereAprobacion=false, programado/confirmado/aptoParaDisponibleHoy=false, proximoIngreso=null y datosFaltantes. La interfaz no pide aprobar un borrador inexistente. Hasta seis líneas, una acción y monto declarado separado de dinero recibido. Completar datos no activa calendario: requiere un futuro flujo explícito con confirmación, evidencia, idempotencia y recuperación. No reescribe calendarios/históricos ni migra registros antiguos.

## Preparación de /copilot y pendientes reales

La ruta autenticada actual puede crear contexto, borrador PENDIENTE y turno de chat. No aprueba borradores ni llama un registrador financiero desde procesar; la aprobación se solicita por otras rutas con controles propios. Por ello solo POST exacto /copilot se excluye del registro local de mutaciones monetarias, junto con /consulta. PATCH/DELETE, subrutas de aprobación y rutas desconocidas conservan protección. No se clasifica el endpoint como ausencia de escrituras: conserva metadatos y conversación.

El cliente comprueba estado financiero antes y después de esperar /copilot. Un pago/registro incierto o almacenamiento local ilegible bloquea recomendaciones; iniciar/confirmar una mutación durante la espera invalida la respuesta. Cambio de sesión o cancelación mantiene su descarte. POST no se reintenta automáticamente. Error de red/HTTP de chat no crea un sin_clave financiero nuevo. Registros antiguos sin_clave se conservan íntegros: el formato anterior no conserva la ruta y no permite probar su origen a partir de la huella. No se borran para desbloquear la app.

HTML y scripts usan 20261105-copilot-preparacion-v81; publicar juntos al liberar. La clasificación solo describe este código inspeccionado: cualquier futura escritura financiera dentro de copilot debe exigir su mecanismo transaccional/recibo y revisar el contrato. No desactivar controles para añadirla.

## Matriz de aceptación

| Caso | Resultado requerido |
| --- | --- |
| 1 nov 03:00 UTC, día mensual 1 | En Colombia aún es 31 oct; fecha tentativa 1 nov, no hoy |
| 1 nov 06:00 UTC, día mensual 1 | Fecha hoy; ingreso recibido y horizonte futuro desconocidos |
| Febrero bisiesto/no bisiesto y cambio de año | Fin de mes y año correctos, sin TZ del servidor |
| Falta monto o dato monetario ambiguo | null y aclaración, sin copiar fuente anterior |
| Declaración mensual completa/incompleta | Sin consultas históricas, calendario, caja ni borrador de aprobación |
| Chat con respuesta perdida tras conservar turno | Turno original permanece; no crea incertidumbre financiera nueva |
| Hecho enviado a copilot | Borrador propio pendiente, sin movimiento hasta aprobación explícita |
| Registro real con respuesta perdida | Caja cambia una vez; copilot bloqueado hasta confirmar la misma operación |
| Mutación durante chat o cambio de usuario | Respuesta obsoleta descartada; pendientes propios preservados |
| sin_clave anterior | Se mantiene intacto, incluso si pudo ser chat; requiere revisión verificable |

Pruebas locales de fecha/extracción/integración pura y en procesos UTC/Tokyo/Los_Angeles; controlador de mutaciones y frontend VM con fallos/carreras. Integración autenticada debe ejecutar servicios reales y persistencia de turno/borrador con credencial restringida. El transporte/JWT del fixture es simulado y no certifica el HTTP completo o dispositivos reales. La ruta de producción usa personalAuth/entitlement existente.

Límites: turno y borrador no son una única transacción con la respuesta; perderla puede dejar un registro disponible sin acuse. Reenviar manualmente puede crear otro turno/borrador; este lote no promete exactamente una captura. Falta identidad recuperable de solicitud copilot, recibo/consulta de respuesta perdida y protección del texto pendiente por sesión, sin deduplicar por contenido o borrar originales. No afecta idempotencia de aprobaciones financieras existentes, pero exige revisión de duplicados de captura antes de liberar. Calendario confirmado necesita también flujo propio; no reutilizar esta vista previa como evidencia para gastar.

#407, custodio independiente, respaldo durable/retención/acceso/claves separados y restauración operativa/RPO-RTO, roles/índices/históricos reales, seguridad/dispositivos/compatibilidad e informe final siguen pendientes. Sin cambios de modelos, índices, roles, formato backup ni datos reales; sin merge ni Render.
