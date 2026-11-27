# Confirmaciones sin sobrescribir el control personal — V81 r144

Fecha:27 de noviembre de2026. Ámbito exclusivo Finanzas Personales. Base feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e;HEAD inicial de integración fb00b2b35aba2d3e5f8e5b123120b85e89361b01/árbol4060a94a28f56eb70d3a83cbb380172ff252ad9f. PR389 abierto/no integrado;#407 es issue abierto,cuatro comentarios,sin evidencia nueva. CI inicial Gate45964779746/Seguridad45964779781/V8145964779771 success,13jobs;job140390757608 Mongo110/110,Chromium33/33 y ambos marcadores r143. Respaldo sintético46colecciones/8264documentos/8486062bytes,captura243ms/restauración878ms/edad1117ms,custodiaIndependiente=false/rpoProduccion=false. Esto cierra la verificación del checkpoint anterior,no constituye evidencia operacional.

## Problema, plan y aceptación

Seis reproducciones fallaron antes de modificar código: registro manual,constancia histórica,calendario,rechazo de calendario,imputación y restauración de cuota podían confirmar desde el Map cargado y guardar una raíz sin una referencia incorporada externamente después. No se modificó ningún dato real. El bloque corrige esas confirmaciones y su integración;no cuenta los commits como bloques.

Criterios:
1. Un recibo/cuerpo verificado solo resuelve su clave y huella,con tipo y usuario compatibles. No se interpreta saldo/lista vacía/404 como confirmación.
2. Antes de quitar la clave,comparar la raíz persistida con el control actual. Una incorporación,reemplazo,eliminación de otra clave,raíz ausente o dañada conserva el texto real,bloquea el control y devuelve false. Nunca sobrescribir para reparar.
3. Permitir convergencia sin escritura únicamente si la raíz corresponde exactamente al control menos la misma referencia respaldada por el recibo;las demás deben permanecer iguales. Repetir confirmación idempotente no escribe.
4. Fijar copias de cuerpo/recibo antes de awaits. Cambios durante hash,sesión tardía,operación activa,tipo/huella contradictorios o escritura fallida no liberan otra operación. Mantener aislamiento de dueño y otras claves.
5. API manual consume el resultado:si no pudo resolver el control,no devuelve una confirmación utilizable silenciosamente. Verifica sesión/abort antes y después del paso asíncrono.
6. UI real conserva diario/cuerpo/clave ante conflicto;GET propio tras recarga explícita confirma solo la solicitud y conserva otra referencia pendiente. C3 sigue bloqueada y ningún POST financiero se reenvía.
7. Regresiones,CI del código exacto y documentación versionada;sin cambios a backend,migraciones,roles,dependencias o gates.

## Implementación

resolverControlConfirmado comparte la resolución de las seis confirmaciones. exigirControlOriginal ya existente valida coherencia semántica;una divergencia deja error bloqueante en memoria sin cambiar la raíz persistida. La convergencia de dos controles usa el mismo criterio estricto que retiro r143:solo la clave recibida ya ausente,sin operaciones activas y sin escritura de la raíz. Una clave ausente del Map no hace que se acepte una raíz externa desconocida.

confirmarRegistro admite vigente;API /transacciones/confirmar-intento la vincula al token y AbortController capturados y trata false como OPERACION_PERSONAL_NO_CONFIRMADA. Esta función recibe la comprobación propia del endpoint;no se convierte en verificador autónomo de recibos manuales. Constancias siguen exigiendo el verificador de constancia;calendario/imputación/restauración conservan sus validaciones previas de cuerpo,huella,versión,identidad y efectos financieros. Copias de entradas impiden redirigir la resolución mutando objetos durante un await.

No se altera el formato de almacenamiento,el cuerpo de solicitudes,la clave,idempotencia del servidor,diarios locales,archivos o cifrado. Recursos personales20261127-confirmacion-control-v81 conservan orden de carga.

## Validación y evidencia

test/finanzas-personales/confirmacionControlConcurrente.test.js:56casos nuevos,seis reproducciones originales,cambios durante hash,otros pendientes,raíz dañada/ausente,convergencia de dos controles,idempotencia,operación activa,sesión tardía,escritura ignorada/cuota,caché vacía con incorporación externa,cuerpos/recibos mutados,API manual real sin reenvío.191/191 pruebas dirigidas iniciales. Módulo y ci:personal se registran al completar ejecución;omisiones locales de integración no acreditan Mongo.

confirmacion-control.browser-helper.cjs amplía los casos existentes de restauración aplicada/cerrada e imputación aplicada/no aplicada. Conserva la referencia extra sintética,sin retirarla para que el test pase. GET reales contra backend/JWT/Mongo autorizado,UI390px:primer conflicto conserva raíz literal y diario,recarga y segundo GET resuelven solo su clave,otra referencia sigue pendiente y bloquea asesoría,0POST financiero. Snapshot de fuentes/caja/pagos/eventos intacto. Marcador FP_CONFIRMACION_CONTROL_CONCURRENTE_BROWSER. Mantiene33casos,timeout120000ms,concurrencia máxima2 de grupos independientes,cuotas,expiración y demás aserciones;CI propia pendiente.

## Límites y siguiente paso

Este bloque protege seis rutas de confirmación. No certifica todos los escritores del control:inicio/finalización genéricos y otros tipos de recibo requieren revisión prioritaria con reproducción. sessionStorage no ofrece una transacción CAS entre documentos ni respaldo durable independiente;comprobación y escritura son síncronas en el contexto actual y no prueban resistencia a JavaScript con control del perfil. Copias de navegador pueden perderse;no se promete recuperación garantizada.

Siguiente:reproducir y corregir pérdida de referencias ante inicio/finalización genéricos y restantes confirmaciones del control,conservar originales y verificar compatibilidad de recuperación/copia portable. Después pendientes de matriz. Al retomar:instrucciones,HEAD/base,PR389,issue407,CI,CONTINUIDAD,matriz y este informe;no depender de temporales.

Release sigue bloqueada por #407,custodio/anclas independientes reales,backup durable independiente/retención/accesos/credenciales administrativas separadas,restauración operativa aislada/RPO-RTO reales,roles/índices/configuración/migración productivos,dispositivos/Safari/carga/auditoría independiente/compatibilidad/informe final. No merge ni Render hasta cumplir todos los criterios. Sin main/Empresarial/Blushéa/datos reales/nuevos servicios o costos. Tarea activa.


Validación local final r144:56/56 nuevos,191/191 dirigidos y85/85 API/control;1255casos del módulo/1246aprobados/9omisiones de integración local,0fallos/cancelaciones;ci:personal353/349/4omisiones,0fallos/cancelaciones. La primera ejecución completa señaló una prueba que esperaba éxito silencioso con cuerpo diferente;ahora exige rechazo OPERACION_PERSONAL_NO_CONFIRMADA y conserva su aserción de bloqueo. Sintaxis y diff--check aprobados. CI propia pendiente;no inferir integración desde omisiones locales.


Corrección del mismo bloque r144:las seis confirmaciones ahora marcan el control como no verificable si getItem de su raíz falla,incluso con Map vacío. Seis nuevas reproducciones fallaban antes de esta guarda;evita que al recuperar la lectura reaparezca autorización sin revisión. No escribe ni repara la raíz. Suite nueva62casos;91/91 API/control. Primer código608b70d5eff224d46f9d5b26234d04c8051a1dbe/árboldec25f52a0fb96cc1149465a8219180643bcefc6 publicado;su CI no cubre esta guarda posterior,que requiere SHA/CI propios. Se mantiene un solo bloque funcional. Próximo:inicio/finalización genéricos y restantes recibos;bloqueos de entrega independientes intactos.


Validación local de la guarda final r144:62/62casos nuevos,197/197dirigidos,91/91 API/control;módulo1261casos/1252aprobados/9omisiones de integración local,0fallos/cancelaciones. ci:personal previo353/349/4omisiones,sin fallos;CI exacta de esta corrección pendiente. No se atribuye a omisiones locales evidencia de integración.


CI del primer código608b70d5:Gate45985115892 y Seguridad45985115891 success;PrecisiónIntegridad45985115908 failure en job140458627422. Mongo110/110 aprobado. Chromium33casos/31aprobados/2fallos(contando padre),0omisiones/cancelaciones;falló CONTROL_PERSISTENCIA_IGNORADA_Y_CONFIRMACION_MANUAL al esperar CONFIRMADA tras una consulta cuyo control tenía error de escritura. Los cuatro FP_CONFIRMACION_CONTROL_CONCURRENTE_BROWSER(RESTAURACION,CIERRE,IMPUTACION_APLICADA,IMPUTACION_NO_APLICADA) sí pasaron,2GET propios por modo,0HTTPasesoría/0reenvíos. No se declara CI verde del primer código.

La prueba antigua ahora exige que esa consulta fallida deje diario PENDIENTE y bytes originales;tras recarga explícita otro GET propio confirma,y un GET adicional verifica idempotencia del registro ya confirmado. Conserva todas las aserciones de caja/fuentes/clave/390px,un único POST financiero y5consultas propias,33casos/timeout120000ms/concurrencia2/cuotas intactos. FP_CONTROL_PERSISTENCIA añade consultaFallidaNoConfirmaDiario:true. Regresión API real reproduce el mismo control fallido y recuperación por instancia recargada,sin POST financiero adicional. Suite nueva63casos,92/92 API/control;requiere CI del SHA corregido.


Validación local definitiva tras correcciones de lectura y contrato UI:63/63casos nuevos,198/198dirigidos,92/92 API/control;módulo1262casos/1253aprobados/9omisiones de integración local,0fallos/cancelaciones;sintaxis/diff--check aprobados. La nueva evidencia de Chromium depende de CI del SHA corregido;la ejecución anterior fallida queda conservada arriba. No relajación de gates ni despliegue.
