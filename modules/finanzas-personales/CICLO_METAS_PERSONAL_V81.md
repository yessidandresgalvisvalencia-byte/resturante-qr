# Ciclo recuperable de metas declaradas — r91

## Base y plan verificable
13 de noviembre de 2026. PR389 abierto/sin merge, integration/fp-hormiga-clasificacion-credito-v81 hacia feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. HEAD real iniciala0e3e3c13ad32bc720b01567004c17bd0193289b, árbolb3e9c6946a92be13432f03e094cdf92017133d6e. Gate43380865035/Seguridad43380865092/V8143380865031 success; Mongo83/83/browser18/18 en job131738047375. #407 sigue siendo issue abierto con seis criterios y gate independiente.

Un bloque seleccionado: corregir declaración, retirar lógicamente, restaurar y consultar historial de metas creadas con recibo. Conservar fuente original y recibo de creación; el ciclo no reserva efectivo, registra aportes/ingresos ni altera caja. No se considera aplicación terminada ni liberable.

1. Eventos originales append-only y cursor técnico propio para serializar creación/cambios.
2. Proyección del listado y resumen desde fuente+recibos+eventos del mismo snapshot.
3. Interfaz con confirmación, motivo, versión y recuperación de respuesta conservando cuerpo/clave.
4. Pruebas normales/fallos, concurrencia, aislamiento, atomicidad, integridad, permisos, respaldo y navegador real.
5. Publicar con expected_sha y force=false, árboles iguales y tres CI del SHA exacto; cerrar evidencia y siguiente paso aquí, matriz y continuidad.

## Contrato y aceptación
- POST /metas/:id/corregir: confirmacion=true, versionMeta, motivo (8..240 caracteres) y datos exactos nombre/objetivo/acumulado/fechaObjetivo. COP enteros seguros; acumulado declarado entre0 y objetivo positivo. Rechazar coerciones, campos extras, datos iguales, versión desactualizada, meta retirada y nombre reservado por otro original o declaración vigente. Nombres NFKC/mayúsculas; no fusionar duplicados.
- Corrección de fecha: conservar fecha anterior aunque haya vencido; si cambia, exigir fecha civil colombiana válida de hoy/futuro. Replay de evento histórico no depende de la fecha actual.
- POST /metas/:id/retirar: confirmacion/version/motivo. Conservar original y correcciones, marcar retirada solo en proyección. Retirar excluye la meta del resumen activo, nunca descuenta dinero.
- POST /metas/:id/restaurar-retiro: además retiroHash exacto vigente. Restaurar conserva la última declaración corregida y no genera efectos financieros. Idempotencia exige clave ciclo_meta_... estable; clave reutilizada con otro cuerpo/tipo/meta da409. El recibo histórico no certifica estado actual.
- GET /metas/recibos-ciclo/:solicitudId y GET /metas/:id/historial?pagina=1: JWT dueño, recibo ajeno404, historial20/página, máximo50páginas. Originales/eventos completos en servidor; texto y antes/después declarados se presentan sin ejecutar HTML.
- Solo fuentes con recibo de creación verificado son editables. Legados sin recibo permanecen visibles y originales; no se inventa adopción ni historial anterior. Su ciclo se rechaza hasta un flujo explícito separado.

## Integridad, concurrencia y operación
fin_metas y fin_recibos_creacion_metas_personales_v1 permanecen intactas. Nueva fin_ciclo_metas_personales_v1 INSERT-only guarda dueño, meta, secuencia por dueño, revisión por meta, motivo/cuerpo, original, declaración anterior, fecha, referencia y hash encadenado. Índices únicos dueño+secuencia, dueño+clave y dueño+meta+revisión.

fin_cursor_metas_personales_v1 es proyección técnica mutable, no historial financiero: índice único por dueño, revisión CAS, conteos/hash final de creación y eventos. Se actualiza atómicamente con la inserción; creación y cambios comparten este cursor para cerrar la carrera entre alta y renombrado. No usa ni modifica el cursor de compensaciones financieras. Replay y consultas no incrementan cursor. Fallo de evento/cursor aborta toda la transacción.

Lecturas verifican fuentes y recibos, cadena, referencias, versiones, conteos/hash de cursor y capacidad. Si faltan eventos con cursor, fuente, recibo o índices, fallan cerrado conservando todo. Máximo500 metas,5000eventos/dueño y1000eventos/meta. Sin cursor y sin eventos se permite leer/adoptar técnicamente como base una creación r90 verificada; la primera escritura explícita crea metadatos sin reescribir fuentes. No puede distinguir una base r90 sin cursor de la eliminación administrativa de un cursor sin eventos; no se certifica integridad externa completa. Eventos presentes sin cursor bloquean recuperación automática.

Política/modelo protegen25 colecciones. El cursor requiere UPDATE como proyección; esto no autoriza UPDATE/DELETE del historial. Requiere provisión administrativa e índices reales antes de operar en otro entorno. No ejecutar provisión, migración, reparación ni restauración productivas en este lote.

Respaldo V22 incluye44 colecciones (ciclo+cursor); V21 exacto42 y V20 exacto40 se mantienen compatibles. Ensayo de restauración solo en base aislada. Cifrado y verificación local no acreditan destino/custodio independiente real, retención operativa, acceso separado ni RPO/RTO productivos.

## Interfaz y límites de evidencia
Revisar meta carga sus datos/version; exige motivo y confirmación explícitos. Retirada no ofrece guardar corrección. Nueva meta conserva formulario hasta decisión explícita. Respuesta en vuelo no borra ediciones nuevas ni se aplica a otra sesión/meta. Doble clic se bloquea; respuesta perdida mantiene solicitud completa y clave por propietario. Tras recarga se consulta primero el recibo;404 no prueba ausencia de aplicación y solo reenvío confirmado reutiliza cuerpo/clave/referencia originales. Una respuesta de retiro/restauración no registra dinero.

Plan de pruebas: contrato y dinero/fechas inválidos, cadena y versiones, restaure/replay, corrupción/truncamiento/cursor perdido, fallback r90, legado, carreras misma/diferente clave, creación vs renombrado, rollback, nombres duplicados, snapshot del resumen, paginación, roles nativos UPDATE/DELETE, respuesta perdida con navegador/backend/Mongo real y caja intacta. Pruebas locales iniciales: puras/handler6 e interfaz5, respaldo/permisos34; módulo antes de la última regresión UI834/825/9, ci:personal353/349/4, cero fallos. Ensayos Mongo/navegador del nuevo SHA pendientes antes de cierre.

El entorno perdió conexión durante la integración y volvió a estar disponible; se verificó el estado local y se retomó sin publicar borradores incompletos. Esta incidencia no se presenta como bloque funcional ni certificación.

## Pendientes y siguiente paso
Adopción explícita y recuperable de metas legacy sin recibo, sin inventar eventos antiguos; auditoría contextual IP/dispositivo y política de minimización/retención. Aportes bancarios/caja, pruebas físicas/Safari, migración histórica efectiva, roles/índices productivos, custodio independiente y backup-restauración operativo/auditoría independiente siguen pendientes. Hash no impide reescritura coherente por un administrador con privilegios suficientes. #407 permanece abierto. Sin merge a feature/main, Render, costos, otros productos o datos reales modificados.

## Validación inicial r91 y correcciones
Publicado7cd485907728eb0671a0dcbf6499e40531b2d34d/árbol2c29515fb1252824769020b76e9c1db51285abed con lease y árboles iguales. V8143391204486 detectó en job131771264262 que la preparación del ensayo de compensaciones no inicializaba índices/modelos de metas requeridos ahora por el resumen; se añaden a la provisión de ese ensayo aislado. No se elimina la exigencia de índices en runtime. La UI incorpora además confirmación antes de reemplazar un formulario sin enviar y preserva esos datos al retirar/restaurar otra meta, con regresión propia. El nuevo SHA requiere CI completa. El entorno está nuevamente accesible; la incidencia previa fue transitoria.

El job autorizado131771264586 del código7cd4859 sí completó Mongo84/84 y navegador/backend19/19 sin fallos; FP_CICLO_META confirmó original intacto, pérdida de respuesta recuperada, tres decisiones/una consulta, restauración e historial sin cambiar caja y ancho390. Backup aislado44 colecciones/6203documentos/4211134bytes, captura235ms/restauración1098ms/edad1278ms, custodiaIndependiente=false/rpoProduccion=false. El fallo de la otra preparación de Mongo mantiene V81 global no aprobado en ese SHA; no se usa este resultado parcial para habilitar gates. Local tras protección de formulario836/827/9, doce pruebas nuevas puras/interfaz y respaldo/permisos34/34; cero fallos. Descendiente con preparación corregida requiere las tres CI exactas.

## Reserva de recuperación por capacidad r91
Se reserva capacidad para restaurar cada retiro vigente: nuevas correcciones/retiros no pueden consumir esos lugares; un retiro por meta tampoco consume su último evento de restauración. Rechazar nuevas operaciones por capacidad conserva originales y metadatos; no poda ni archiva automáticamente. Regresión pura de fronteras y ensayo Mongo con998 eventos sintéticos válidos comprueban retiro999, restauración1000, historial paginado completo y rechazo posterior sin cambios. El caso global5000 con retiros pendientes se comprueba en C2 puro; no se presenta como prueba de volumen productivo.

El código intermediofb3c1ea37e4d807c1a1fdecc772d9535b9a0bd87/árbola93dff4a50ea2fca912ad360a8227fd5ed24f2ea aprobó Gate43391830385/Seguridad43391830596/V8143391830360 (job autorizado131773351556). La reserva de capacidad es una corrección posterior y requiere nuevas CI. La capacidad de negocio rechaza con409, no503: un rechazo explícito de una operación nueva no debe dejar una incertidumbre artificial que impida restaurar otra meta. Lecturas incoherentes/infraestructura ausente siguen fallando cerrado; no se borran solicitudes realmente inciertas.
