# Inicio, transporte y finalización del control personal — V81 r145

Fecha:27 de noviembre de2026. Solo Finanzas Personales. HEAD inicial de integración b6983861a363b4b69bf2f3b8870987641e17aed0/árbol756cf15806b44b51d50014bad5b6f063866d8d90;feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e intacta. PR389 abierto/no integrado;#407 es issue abierto,cuatro comentarios sin evidencia nueva. CI inicial Gate45986730971/Seguridad45986730980/V8145986730954 success,13jobs;Mongo110/110 y Chromium33/33 confirmados en cierre r144. Sin instrucciones AGENTS.md versionadas adicionales;se conservan instrucciones del proyecto y usuario.

## Problema y plan del bloque

El Map de pendientes podía quedar desactualizado respecto de sessionStorage. El inicio genérico y finalizar podían guardar esa copia y perder referencias incorporadas externamente. La finalización incierta no escribía,pero tampoco detectaba el conflicto. Antes de modificar código:25reproducciones,24fallos/1aprobada(el inicio de retiro ya tenía guarda r143). Se conserva esa cobertura.

Un bloque funcional:verificar coherencia del control al iniciar y después del hash,conservar solicitud antes del transporte,revalidar inmediatamente antes de fetch y antes de finalizar,propagar fallos y bloquear asesoría ante un estado desconocido. No convertirlo en reparación,limpieza o fusión silenciosa de pendientes.

## Criterios de aceptación e implementación

1. verificarControlActual rechaza un control ya fallido,lectura interrumpida o raíz semánticamente distinta;marca discrepancias/errores como bloqueantes sin escribir la raíz. Se comprueba antes/después del await de hash y antes de incorporar la referencia. Guarda verifica su escritura;si falla,conserva pendiente/error e invalida disponibilidad.
2. iniciar recibe vigente y captura opciones/cabeceras antes del await;no cambia método,cuerpo ni clave por mutación del objeto original. Cambio de sesión antes de guardar no crea referencia ni envía. Se mantienen separación por dueño,tipo de clave,capacidad100,reintento con misma huella e id original,restricciones de legados/cierres y referencias sin clave.
3. Cada operación entrega verificarAntesDeEnviar. API real la llama sin await entre esa comprobación y fetch,después de verificar sesión/abort. Exige control coherente,misma referencia activa y operación no finalizada. Un conflicto aparecido después de resolver iniciar impide HTTP.
4. finalizar es idempotente;retira solo la marca de actividad y verifica raíz/identidad del pendiente antes de cambiarlo. Ante discrepancia,lectura/error previo,conserva raíz literal y pendiente y devuelve error OPERACION_PERSONAL_NO_CONFIRMADA;invalida disponibilidad incluso al fallar. No interpreta desaparición como acuse ni converge por respuesta HTTP genérica. Un finalizador antiguo no resuelve el reintento posterior.
5. Protocolo anterior conservado:CONFIRMADA resuelve solo su referencia en control coherente;RECHAZADA/NO_ENVIADA resuelven solo solicitud nueva,no una incertidumbre previa;INCIERTA conserva. Retiro/restauración de deuda conserva su copia en todos los resultados hasta recibo propio(r143). No se borran otras claves ni se generan nuevas por reintento.
6. estado compara raíz/Map en modo de solo lectura y bloquea asesoría si difieren o no se puede leer. Conserva identidad/cantidad conocida de pendientes,no escribe ni marca error permanente por esa lectura;permite convergencia posterior con recibo vinculante explícito(r144). Una consulta en vuelo se descarta ante nueva discrepancia. No se infieren cero pendientes ni saldos desde una caché vacía.
7. Operaciones independientes del mismo control pueden solaparse:se usa estado coherente actual tras cada await,no se exige que toda revisión quede congelada. Confirmar una conserva las referencias de la otra. Las guardas de sesión evitan transporte con un contexto cambiado.
8. Se conservan diario,archivos,cuerpo/idempotencia,recibos,formatos y recuperación existentes. Recursos personales20261127-inicio-cierre-control-v81,orden de carga intacto. Sin cambios backend/esquema/migraciones/roles/índices/dependencias/gates.

## Validación

66casos nuevos en inicioCierreControlConcurrente.test.js:cinco mecanismos(header,externalId,solicitudId,sin clave,retiro),incorporación antes/después del hash,cuatro resultados de cierre,raíces ausentes/dañadas/reemplazadas,lectura interrumpida,cuerpos/cabeceras mutados,normalidad/idempotencia,solapamiento de dos operaciones,sesión/usuario,finalizador antiguo,verificación prefetch,HTTP200/400/503,asesoría antes/durante consulta y convergencia con recibo.199/199regresiones de control;208/208dirigidas incluyendo HTML/versiones. Suite módulo1328casos/1319aprobados/9omisiones de integración local,0fallos/cancelaciones;ci:personal353/349/4omisiones,0fallos/cancelaciones. Las omisiones no acreditan Mongo.

La primera ejecución completa señaló que estado,al fallar la lectura de raíz,perdía la cantidad conocida de pendientes en su respuesta. Se corrigió para devolver bloqueo conservando metadatos conocidos;la aserción original de persistencia no se cambió y pasó. Sintaxis/diff--check aprobados.

inicio-cierre-control.browser-helper.cjs amplía CONTROL_PERSISTENCIA_IGNORADA_Y_CONFIRMACION_MANUAL existente,sin quitar aserciones ni cambiar33casos/timeout120000ms/concurrencia máxima2/cuotas/expiración/credenciales. Reutiliza usuario sintético ya autenticado,sin nuevos logins:
- Referencia externa con Map vacío;botón real Guardar movimiento conserva solicitud de25COP,0POST financiero y snapshot intacto.
- Recarga y reenvío explícitos con el mismo cuerpo/id. POST HTTP real201;antes de responder se añade otra referencia sintética. El cierre debe fallar conservando raíz literal y diario PENDIENTE. Solo un ingreso sintético nuevo de25COP,originales previos intactos.
- Nueva recarga y GET propio confirman solo esa clave;dos referencias externas permanecen,no hay segundo POST ni nueva fuente/caja. Pregunta real de gasto bloqueada antes de HTTP;390px.
Marcador FP_INICIO_CIERRE_CONTROL_BROWSER;CI propia del SHA publicado pendiente. Este ensayo incluye una operación nueva exclusivamente sintética;no se afirma snapshot anterior intacto después de esa operación autorizada del fixture. Se compara snapshot de commit antes/después del GET para detectar duplicación.

## Límites, bloqueos y siguiente paso

Guardas de coherencia en un contexto JavaScript;sessionStorage no ofrece CAS transaccional entre documentos ni respaldo durable independiente. No se promete inmunidad ante un actor con control del perfil,imposibilidad de pérdida o recuperación garantizada. Lectura coherente no certifica saldo ni permiso de gasto por sí sola. No se fusionan referencias externas ni se reconstruyen originales desde hash.

Otros confirmadores/escritores específicos aún requieren revisión y reproducción antes de dar por protegido todo el control. Siguiente:extender resolución segura a aprobaciones/creaciones/conciliaciones/ciclos y confirmaciones de revisión/origen sin perder recibos/archivos;después copia portable completa y matriz. Al retomar:instrucciones,HEAD/base,PR389/issue407/CI,CONTINUIDAD,matriz y este informe.

Release bloqueada por #407,custodio/anclas independientes reales,backup durable independiente/retención/accesos/credenciales administrativas separadas,restauración operativa aislada/RPO-RTO reales,roles/índices/configuración/migración productivos,dispositivos/Safari/carga/auditoría independiente/compatibilidad/informe final. Sin merge ni Render hasta aceptación íntegra. No main/Empresarial/Blushéa/datos reales/nuevos servicios/costos. Tarea activa.
