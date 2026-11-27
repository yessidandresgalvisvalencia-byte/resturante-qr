# Calendario de ingresos gestionado por eventos V81

Revisión del 5 de noviembre de 2026. Ámbito: API personal y sus consumidores Home/proyección, no desplegado. Este bloque implementa gestión recuperable de calendarios nuevos. La interfaz y la adopción explícita de calendarios legados siguen como bloques posteriores.

## Contrato

Cada calendario tiene identidad estable, eventos INSERT-only con solicitud exacta, huella SHA256, versión previa esperada, estado anterior/posterior, actor del JWT, fecha, IP y agente recibidos por el servidor, hash previo/actual y orden único del propietario. No tiene una proyección mutable que sustituya originales. El estado se reconstruye y verifica antes de leer o escribir. CREAR/CORREGIR requieren concepto, importe entero positivo, día mensual 1–31 y fecha civil explícita colombiana coherente con el día (incluido fin de mes). La primera fecha debe estar entre hoy y 31 días después: no se autoriza caja basándose en años de ingresos futuros.

Un calendario gestionado solo declara esa próxima ocurrencia. Si vence hoy o antes queda pendiente, sin inferir recepción y sin avanzar automáticamente al mes siguiente. Cambiar la próxima fecha exige CORREGIR confirmado. La proyección incluye una sola ocurrencia explícita, sin multiplicar el ingreso por meses. Programar, corregir, retirar o restaurar no inserta transacciones financieras, no aumenta saldo y no escribe outbox.

RETIRAR genera un evento lógico y conserva todos los datos. RESTAURAR exige la versión vigente y el hash del retiro exacto; devuelve los datos anteriores sin generar caja y mantiene fecha vencida pendiente si corresponde. CORREGIR solo opera activo. Un reintento con misma clave/cuerpo devuelve el recibo original, que no certifica estado actual; clave con otros datos da 409. Una carrera puede devolver 409 y debe consultar el recibo o repetir exactamente la misma solicitud; no inventar otra clave. Los índices únicos de versión, orden del usuario y solicitud evitan duplicación y serializan también calendarios distintos del mismo propietario sin cambiar el cursor financiero.

Límites explícitos: 5000 eventos por usuario, 1000 por calendario, lecturas limitadas con maxTimeMS=5000; un exceso devuelve error sin subtotales. Historial de 20 por página hasta página 50, disponible para el propietario incluso retirado. Se verifican todos los eventos propios antes de responder. Reordenación, huecos, hash/estado/actor inconsistentes o índices ausentes bloquean; no se reparan ni borran fuentes. Esto no detecta por sí solo un truncamiento de cola o reescritura total por credenciales administrativas; requiere custodia independiente real y controles operativos de #407.

## API autenticada

Prefijo /api/finanzas-personales, después de personalAuth y entitlement, respuestas privadas no-store. La identidad solo procede del JWT verificado; usuarioId en cuerpo o selección de dueño en query se rechazan. Escrituras comparten el limitador V81: Redis disponible es obligatorio en producción, sin fallback a memoria.

| Método/ruta | Resultado |
| --- | --- |
| GET /calendario-ingresos | Calendarios gestionados propios, activos y retirados, versión/hash y retiroHash |
| GET /calendario-ingresos/recibos/:clave | Recibo original recuperable por propietario |
| GET /calendario-ingresos/:id/historial?pagina=1 | Eventos propios completos paginados |
| POST /calendario-ingresos | CREAR; ID derivado de propietario y clave estable |
| POST /calendario-ingresos/:id/eventos | CORREGIR, RETIRAR o RESTAURAR con versión esperada |

Ejemplo sintético de creación (no registrar estos datos en producción):

```json
{"solicitudId":"cal_ingreso_ejemplo_00001","solicitud":{"accion":"CREAR","confirmacion":true,"versionEsperada":0,"motivo":"Programación revisada por el propietario","datos":{"concepto":"Ingreso previsto","montoMinor":500000,"diaMes":10,"fechaProxima":"2026-11-10"}}}
```

CORREGIR incluye los cuatro datos completos y la versión actual; no se infieren campos omitidos. RETIRAR omite datos y conserva motivo. RESTAURAR omite datos e incluye retiroHash del calendario retirado. Todas las acciones requieren confirmacion=true, motivo de 8–240 caracteres y clave cal_ingreso_ seguida de 8–80 caracteres ASCII alfanuméricos, guion o subrayado. Importes y versiones no aceptan coerción de texto o fracciones.

## Integración y protección

Home lee eventos en su sesión snapshot junto a fuentes legadas y caja; una consulta no mueve fechas ni caja. Las referencias gestionadas usan modo EVENTOS_V1 y fechaProxima, manteniendo salida compatible de asesor.proximoIngreso y null si falta horizonte. La proyección usa los mismos eventos en su snapshot y no repite mensualmente una fecha confirmada.

Colección nueva fin_eventos_calendario_ingreso_personales_v1, modelo protegido número 19. El arranque exige sus tres índices, sin crearlos en la conexión de aplicación. La provisión administrativa existente descubre el modelo; no se ejecutó sobre producción. Política nativa exige find/insert/listIndexes y rechaza UPDATE/DELETE del historial. Hooks son defensa adicional, no sustituyen MongoDB ni custodia externa. IP/agente describen lo recibido por el servidor, no certifican identidad física ni dispositivo.

Respaldo V18 incorpora la colección: 38 colecciones. Validación V1–V17 conserva sus alcances exactos, sin inventar eventos ausentes en copias antiguas. Restaurar una copia anterior no implica tener calendario nuevo completo; debe revisarse su alcance antes de habilitar nuevas rutas. No se cambia ningún dato de usuario al instalar código; la compatibilidad de provisión/roles/índices y respaldo completo es gate operativo previo a despliegue.

## Criterios de aceptación y validación

| Criterio del bloque API | Prueba |
| --- | --- |
| Creación/corrección y retiro/restauración sin caja | Casos puros + fixture HTTP/MongoDB de propietarios reales aislados |
| Confirmación, versión, propiedad y fechas estrictas | Handler/puro y JWT HS256 real con identidad vigente/entitlement en router real |
| Idempotencia/concurrencia y respuesta perdida | Creación/restauración simultáneas, replay, conflicto de cuerpo, GET recibo tras fallo de cierre |
| Snapshot con cambio concurrente | Home conserva versión de calendario anterior y siguiente consulta observa corrección |
| Datos originales y gestión recuperable | Comparación de fuentes/evento original; listado retirado e historial propio; rechazo de otro usuario |
| Fallos sin reparación ni efectos duplicados | Índice retirado, inserción fallida, cierre posterior a commit y corrupción administrativa simulada |
| Protección y respaldo | UPDATE/DELETE nativos rechazados; ensayo de respaldo V18, BSON/índices y restauración aislada |

Validación inicial: 10 pruebas nuevas puras/handler, 39 controles de roles/inventario/Home/respaldo, sintaxis general/dirigida y diff correctos. Módulo antes de la última regresión mensual: 473 casos/464 aprobados/nueve omitidos/cero fallos; ejecución final local y CI autenticada pendientes al escribir este checkpoint. No contar integraciones omitidas como aprobadas ni este bloque como desplegado.

## Pendientes y límites

Los calendarios legados permanecen intactos y con el comportamiento anterior; no se adoptan ni se corrigen silenciosamente, ni se deduplican por concepto/monto. El usuario debe distinguirlos al crear un calendario nuevo; una adopción con evidencia original requiere diseño/confirmación propios. Falta interfaz de gestión con recuperación de solicitud local, vista de legados y prevención de selección obsoleta, y aceptación en dispositivos. Falta vincular recepción real a la ocurrencia mediante evento idempotente sin duplicar el ingreso; este bloque no registra pagos ni confirma recepción.

#407 sigue abierto. Faltan custodio independiente real, respaldo completo durable/retención/acceso y claves separados, recuperación/RPO-RTO operativos, roles/índices/históricos reales y aceptación integral de seguridad, interfaz y compatibilidad con informe trazable. El ensayo no equivale a certificación externa ni garantiza recuperación. Sin merge a feature ni Render, costos, migraciones, borrados o restauraciones sobre datos reales.


## Cierre de evidencia del código

Código inicial `c6a6a23d87d1e10f175b5d2ee8cb2753109f1379`; código completo corregido `6d9dd4a8b202511455a6778d2eaa6e8c424f42d8`. Veinticuatro archivos cotejados byte a byte contra remoto. [Gate 42041466189](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42041466189), [Seguridad 42041466073](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42041466073), [V81 42041466080](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/42041466080) success; siete jobs V81 y 65 pruebas MongoDB autenticadas/cero fallos. El primer SHA no fue verde: se corrigieron los fixtures antiguos de índices y la respuesta 404 antes de comprobar versión de fuente inexistente/ajena, sin retirar controles ni cambiar expectativas para aprobar.

La prueba nueva ejecutó Express y el router personal real con JWT HS256, identidad vigente y entitlement. Sin token rechaza; seleccionar propietario en query/cuerpo rechaza. Creación concurrente conserva un evento y replay/recibo no crean otro. Cuerpo distinto con la misma clave y versión vieja dan 409; otro usuario recibe 404 para historial/recibo/mutación ajenos y listado propio vacío. Calendario de 500 habilita horizonte con caja original 1000 y Disponible Hoy 900; proyección suma 500 una sola vez en los tres horizontes, sin repetirlo cada mes. Cambio concurrente a 600 conserva snapshot anterior en la consulta activa y la siguiente observa 600. Retiro elimina solo su efecto de planificación; restauración concurrente recupera 600 en una identidad y total de cuatro eventos, sin alterar originales/cuentas/transacciones/outbox/calendarios legados.

Fecha vencida sigue pendiente hoy y al día siguiente, sin mover próxima ocurrencia. Fallo de inserción no agrega evento; cierre fallido después del commit permite recuperar recibo y replay sin duplicar. MongoDB nativo rechaza UPDATE/DELETE con código 13; retirar índice bloquea antes de escribir/leer, provisión de ensayo lo repone sin cambiar datos. Corrupción administrativa simulada bloquea lectura/Home y no se repara. Es evidencia del ensayo, no acreditación de todos los dispositivos ni de la configuración productiva.

Local: 474 casos/465 aprobados/nueve omitidos/cero fallos, diez pruebas nuevas puras/handler, 39 controles de contrato, sintaxis general/dirigida y diff correctos. Hay solapamiento entre controles y suite; no sumar como casos distintos. Las omisiones locales no se cuentan como aprobadas; CI autentica su alcance.

Backup V18 del código completo: 38 colecciones, 5332 documentos, 3458122 bytes; captura 198 ms, restauración 887 ms, edad 1041 ms. BSON/índices conservados en base aislada vacía, custodiaIndependiente=false/rpoProduccion=false. No acredita retención/custodio durable ni RPO/RTO y restauración de producción. No hubo provisión ni migración/restauración/borrado sobre información real.

El siguiente commit guarda este cierre y requiere tres CI exactas antes de retomar. Bloque API delimitado por esta matriz, no interfaz ni adopción legada: siguiente trabajo es gestión visible por propietario con almacenamiento de solicitud/clave antes del envío, recuperación por recibo sin prometer estado actual y descarte de respuesta de sesión/revisión obsoleta. Mostrar legados y su procedencia antes de crear/adoptar, sin deduplicar por nombre/monto ni desactivar originales. Posteriormente recepción por ocurrencia idempotente y revisión de obligaciones/progreso/evaluación/plan/históricos. Mantener #407/custodio real/backup completo durable-retención-acceso-claves separados/RPO-RTO-restauración operativa/roles-índices-históricos reales/seguridad-dispositivos-compatibilidad/informe final pendientes. Sin merge a feature ni Render, costos o cambios de datos reales; originales y pendientes antiguos conservados.
