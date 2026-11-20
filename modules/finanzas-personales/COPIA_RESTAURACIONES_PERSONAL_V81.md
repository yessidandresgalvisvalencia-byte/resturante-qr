# Copia y recuperación del diario de restauraciones de pagos · V81

## Plan y alcance r77 · 12 noviembre 2026

Padre remoto comprobado `d6c82d955aeefaad21c46034fa49c92c0b867829`, árbol `e0af21560206c0f3e9b1120a98532a33b4e3750a`. PR #389 abierto en `integration/fp-hormiga-clasificacion-credito-v81`; base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`. Gate 43220265649, Seguridad 43220265698 y V81 43220265560 del padre verdes. #407 revisado, continúa abierto. Instrucciones, README y continuidad revisados, sin AGENTS.md local. Publicar con HEAD/base comprobados y expected_sha, sin force ni ejecución paralela en esta rama.

Un bloque funcional: copia cifrada descargable y recuperación explícita del diario local `gruk.fp.restauraciones.v81:<usuario>`, usado por la restauración de pagos con cambio de ciclo/fecha. Conservar cuerpo, ruta, clave y recibo sin volver a restaurar ni pagar. No es copia de todos los diarios, de todas las restauraciones ni de MongoDB. Se reutiliza el cifrado r75; no cambia algoritmo/KDF ni añade dependencias.

## Aceptación e implementación

- Paquete `FP_RESTAURACIONES_LOCAL_V1`, alcance RESTAURACIONES_CON_CICLO, usuario y raíz original exacta. Su tipo es distinto de FP_DIARIO_LOCAL_V1 manual. La aplicación rechaza el tipo o propietario equivocado aun con frase correcta; no mezclar, fusionar ni sobrescribir diarios.
- Validar hasta cien entradas, claves/rutas/cuerpos estrictos, claves únicas y máximo un pendiente. Raíz en blanco/corrupta se rechaza, sin convertirla silenciosamente en un diario vacío. Raíz de paquete acotada a 1 MiB; sobre cifrado conserva límites de 8 MiB plano/12 MiB archivo del formato compartido.
- PENDIENTE no contiene recibo. CONFIRMADA/NO_APLICADA requieren recibo propio: usuario, solicitudId, ruta, método, préstamo, pago, anulación, campos/flags y huella del cuerpo mediante el validador existente; estado local y noAplicada deben concordar. Verificación asíncrona sin modificar controles financieros. Recibo histórico no certifica saldo ni estado actual.
- Descargar solo tras consentimiento; frase privada no guardada/enviada, controles bloqueados mientras procesa y campo limpiado al terminar/cambiar sesión. Archivo y frase deben conservarse por separado. No se añaden JWT ni claves del servidor al paquete.
- Recuperar solo con validación temporal, plan de conteos y confirmación explícita. Conservar bytes; acuse local del hash primero, raíz al final y relectura de cada escritura. Fallo de cuota puede conservar acuse sin raíz: repetir reutiliza el acuse sin limpieza automática. Rechazar otro diario existente o raíz corrupta. No hay transacción/CAS multipestaña.
- Idempotencia: repetir copia recuperada conserva estados resueltos, recibos y solicitudes posteriores; nunca reponer PENDIENTE sobre un recibo ya recibido. Repetir no vuelve a invalidar vistas. Pestaña original/archivo exterior intactos.
- La activación nueva invalida cifras/lecturas por la revisión r76. Un pendiente importado bloquea C3 aunque no exista el diario general de incertidumbre en la pestaña nueva. Consultar recibo GET es una acción explícita; importar no consulta ni reenvía. La confirmación posterior avanza revisión para que una carga anterior al recibo no absorba la actualización nueva.
- No alterar otros diarios ni eliminar incertidumbres. Un recibo inexistente/ajeno/no verificable mantiene PENDIENTE; los flujos de reenvío o cierre siguen exigiendo decisión expresa y las mismas clave/ruta/cuerpo y autorización del servidor.

## Validación local

Ocho pruebas nuevas en copiaRestauracionesPersonal.test.js: paquetes pendientes/confirmados/no aplicados y JWT renovado; idempotencia con recibo y solicitud posterior; propietario/frase/tipo de paquete incorrectos; recibos falsos o estados contradictorios; cuota en acuse/raíz y reintento; diario existente/corrupto/en blanco/claves repetidas/múltiples pendientes/escritura ignorada; UI con C3 bloqueada sin registro general y consulta GET sin POST; cancelación/respuesta tardía/frase de otra sesión. Las pruebas previas de restauraciones también pasan.

Módulo local: 683 casos, 674 aprobados/nueve omitidos por integraciones externas; CI personal 353 casos, 349 aprobados/cuatro omitidos; cero fallos/cancelaciones. Sintaxis/diff correctos. Versiones de recursos y orden de carga verificados: cifrado compartido antes de ambos consumidores.

## Ensayo real preparado en CI

Dos desenlaces de rutas HTTP/JWT/Mongo autorizado existentes: RESTAURACION aplicada y CIERRE sin aplicar por calendario no vigente. En ambos se pierde la respuesta después del commit y el diario queda pendiente. Descarga real cifrada antes de consultar, pestaña nueva con login, rechazo de otra cuenta, importación sin consultas ni POST, pregunta visible bloqueada sin POST de asesoría, repetición idempotente. Consulta explícita GET obtiene el recibo propio; confirmar no mueve otra vez caja ni modifica fuentes. Exporta también el diario ya resuelto, validando recibo real; reimporta copia pendiente antigua sin retirar ese recibo. Compara raíz original, cuerpo/ruta/clave, snapshot financiero y fuente Mongo original. La pestaña fuente permanece pendiente hasta su propia consulta normal. No usar API privada en el ensayo ni contar reenvío de copia inexistente como éxito. Resultado del SHA de código aprobado según evidencia exacta siguiente; el descendiente documental también requiere CI propia.

## Límites y liberación

Paquete local cifrado no es firma ni prueba independiente de identidad/fuente, ni backup completo de GRUK. Conocer la frase permite descifrar/recrear un paquete; los recibos se cotejan localmente, sin certificar criptografía externa. El servidor vuelve a verificar JWT/propietario/cuerpo al consultar o actuar. Un pendiente importado no prueba que una restauración exista en servidor: no se activa ningún efecto por importarlo. No se copian otros diarios generales ni formularios todavía sin confirmar.

Se mantienen límites del formato r75: sessionStorage/cuota/perfil/pestaña, frase perdida no recuperable, capacidad y ausencia de CAS global. Un diario histórico cerrado sin recibo completo verificable no se exporta como evidencia válida; se conserva y requiere revisión, sin inventar recibos ni borrar originales. Esta extensión no añade archivo por páginas a restauraciones al superar cien entradas, no acredita primera carga offline ni sincronización entre dispositivos. No se garantiza pérdida imposible o recuperación futura.

#407 abierto: custodio independiente real, backups completos protegidos/retención/acceso/claves y restauración operacional aislada con RPO/RTO, permisos/índices/credenciales productivos, dispositivos físicos/compatibilidad e informe integral pendientes. Esta copia no sustituye esos requisitos. Sin merge ni Render ni cambios a main/Empresarial/Blushéa/datos reales/costos; gates conservados.

## Siguiente paso recuperable

Revisar HEAD/#389/#407/CI. Extender conservación/recuperación explícita a otros diarios personales (imputaciones, calendario, captura) con evidencia de identidad, estado y cero efectos financieros al importar. Revisar capacidad de restauraciones sin poda y consultas de recibos históricos tras eventos posteriores. Obtener evidencia independiente real para los bloqueos externos antes de liberar.

## Cierre funcional verificado

Código `e34d06fdd0b0abb476ad93b3043a475bbf80190e`, árbol `ca9d717d753eb291e1534e476e4a393b8349eab8`. Nueve archivos exclusivamente personales, árboles locales/remotos idénticos y publicación con expected_sha/force=false.

- [Gate 43233279728](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43233279728): success.
- [Seguridad 43233280073](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43233280073): success.
- [V81 43233279746](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43233279746): success, ocho jobs.
- Job autorizado 131233897321: Mongo 81/81 y navegador/backend 11/11, cero fallos/cancelaciones/omisiones.
- FP_COPIA_RESTAURACION: modos RESTAURACION/CIERRE, estados CONFIRMADA/NO_APLICADA respectivamente. Ambos fuenteReal=true, descargaReal=true, otraPestana=true, otraCuentaRechazada=true, pendienteBloqueaAsesoria=true, reciboPropio=true, exportacionCerrada=true, idempotencia=true, originalesIntactos=true, postsFinancierosDeCopia=0, consultasDeRecibo=1, cajaSinCambios=true, datos=sinteticos. La operación financiera original sí ocurrió una vez antes de copiar; importar/consultar no la repitió.
- Ocho pruebas nuevas; módulo local 683/674/9 y CI personal 353/349/4, cero fallos. Omisiones locales declaradas; integración autorizada sin omisiones. Sintaxis/diff correctos. No se desactivaron gates ni retiraron casos ni ampliaron timeouts.

Esto verifica el alcance descrito sobre datos sintéticos aislados y recibos de rutas reales, no custodia independiente, recuperación operacional de producción o dispositivos físicos. El SHA documental y sus runs exactos se identificarán en el resumen de #389 al cerrar, sin autorreferencia dentro de su propio contenido. #407 abierto; sin merge a feature ni Render ni cambios a otros productos/datos reales/costos. Siguiente: imputaciones/calendario/captura, capacidad sin poda y recibos tras eventos posteriores, con evidencias propias y sin prometer cobertura total.
