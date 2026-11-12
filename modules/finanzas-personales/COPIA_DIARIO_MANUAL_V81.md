# Copia cifrada y recuperación explícita del diario · V81

## Plan y alcance r75 · 12 noviembre 2026

Padre remoto comprobado `260055671c5f046ba0b6fb3c5612aae6708402b0`, árbol `b2b353e438d4b7d7314f3204efcfc0c4ee2a7c46`. #389 abierto en `integration/fp-hormiga-clasificacion-credito-v81`; base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`. Gate 43203887110, Seguridad 43203886988 y V81 43203887004 del padre verdes. #407 revisado, permanece abierto. Instrucciones, README y continuidad revisados; sin AGENTS.md local. Trabajo solo y con lease al publicar, sin escrituras en otras ramas/productos.

Un bloque funcional: descargar copia cifrada del diario manual propio y recuperarla explícitamente en una pestaña sin otro diario. Conserva bytes originales de raíz/páginas, cuerpos/UUID, recibos, constancias y solicitudes pendientes. No es copia de MongoDB, de toda la aplicación, de otros diarios ni del intento global legado sin propietario. No se añaden JWT, credenciales ni frase al paquete.

## Criterios de aceptación y diseño

- Extraer solo raíz y páginas referenciadas del usuario derivado de sesión, verificando contenido, hashes, cuerpo, constancias, UUID únicos y estabilidad observada. El original permanece intacto.
- Frase privada de 16 a 256 caracteres, con al menos dieciséis después de retirar espacios exteriores para la validación de longitud. La clave usa la frase exacta, sin recortarla ni normalizarla. No guardar/enviar frase; bloquear edición de frase/archivo y nuevas acciones de copia durante el proceso, limpiar campo al terminar o cambiar sesión y restablecer controles para la sesión nueva. No se promete borrado de memoria de JavaScript. Frase perdida significa no poder descifrar esta copia.
- WebCrypto, PBKDF2-SHA256 con 600.000 iteraciones fijas, sal aleatoria de 16 bytes, AES-GCM de 256 bits, IV aleatorio de 12 bytes y etiqueta de 128 bits; dominio fijo como AAD. Los parámetros son contrato de esta versión, no certificación bancaria ni afirmación de superioridad. Sin WebCrypto se rechaza, sin alternativa criptográfica débil. No se agrega dependencia.
- Sobre de campos estrictos, base64 canónico, parámetros/longitudes acotados. Hasta 8 MiB de texto plano codificado y 12 MiB de archivo; veinte páginas más cien entradas activas mantienen límites anteriores. Error de frase/archivo/usuario se reduce a aviso seguro. No interpretar HTML, evaluar código ni aceptar claves/caminos de almacenamiento desde el archivo.
- Validar paquete descifrado y propietario de sesión antes del plan: contenido completo, orden de referencias, hashes, constancias, fechas no futuras y UUID únicos. Vista temporal aislada para validar, sin activar datos ni llamar a la API. Presentar número de solicitudes, pendientes y páginas y pedir confirmación explícita.
- Recuperar sin sobrescribir otro diario ni raíz corrupta. Primero páginas con comprobación de igualdad; después acuse local de recuperación vinculado al hash del paquete; raíz al final. Comprobar escrituras releídas. Fallos pueden dejar páginas o acuse no activados: se conservan y reutilizan en reintento, sin limpieza automática. No hay transacción/CAS multipestaña.
- Repetir la misma copia es idempotente. Si ya se recuperó y los cuerpos originales siguen presentes, conservar confirmaciones y solicitudes posteriores en vez de reponer la raíz antigua. No escribir ni duplicar fuentes financieras. Otro archivo discrepante o diario distinto se rechaza; no hay mezcla o reemplazo automático.
- Recuperar PENDIENTE conserva la incertidumbre y bloquea C3. No se reenvía ni consulta automáticamente. El propietario usa después la consulta explícita existente contra su JWT y cuerpo exacto; un eventual reenvío sigue requiriendo confirmación. No se importan ni eliminan otros controles generales de incertidumbre.

## Validación inicial y reproducción

Diez pruebas nuevas en `test/finanzas-personales/copiaDiarioManual.test.js`: cifrado con sal/IV nuevos, contenido original y archivo, frase/usuario/copia alterada/KDF inválidos, confirmación e idempotencia con cambios posteriores, fallos de cuota de cada paso, diario existente/corrupto/archivo discrepante, paquete incompleto/duplicado/fecha/propietario/hash, WebCrypto ausente/capacidad/frase inválidos, descarga/recuperación UI sin API y bloqueo C3, cancelación/sesión tardía y escritura ignorada/cambio de revisión. Contrato de recurso y orden de carga actualizado. Local módulo 665 casos, 656 aprobados/nueve omitidos por integraciones externas; CI personal 353 casos, 349 aprobados/cuatro omitidos, cero fallos/cancelaciones. Sintaxis y diff correctos.

Chromium/backend amplía el ensayo con una página archivada de cien fuentes y un registro posterior real: descarga real de copia cifrada de 101 solicitudes, incluida una incertidumbre local sintética de un registro realmente confirmado en servidor. Conserva la pestaña original y recupera en otra con login HTTP propio. Rechaza propietario y frase distintos, compara raíz/archivo byte a byte y snapshots de finanzas, verifica cero POST financieros y cero consultas de confirmación al importar, repetición idempotente y C3 bloqueada. Solo la consulta explícita posterior confirma una vez sin reenviar; reimportar conserva esa confirmación. Mongo con rol restringido, JWT/router reales, datos sintéticos aislados. Aprobado para el SHA de código corregido según evidencia exacta siguiente; el descendiente documental requiere su propia CI.

## Límites y protección de información

El paquete solo representa evidencia local del diario; ni propietario declarado dentro del cifrado ni hashes locales sustituyen verificación de identidad/fuente del servidor o custodia independiente. Conocer la frase permite descifrar y crear otro paquete; no hay firma externa. Las constancias del navegador validan estructura/huellas, no el secreto HMAC del emisor. No usar la copia como certificación de saldo, importe vigente, integridad global, ni autorización de gasto. No se ha auditado independientemente la criptografía de esta función.

El archivo descargado debe conservarse fuera de la pestaña, con acceso protegido y frase separada. La aplicación prepara la descarga, pero no puede garantizar que el usuario lo retenga, custodie o restaure en el futuro. No es backup independiente operativo de producción, retención durable automatizada ni RPO/RTO comprometidos. sessionStorage y cuota siguen siendo límites; tampoco hay fusión automática con diario existente ni recuperación del legado sin JWT original. Los otros diarios de mutaciones, aprobaciones, patrimonio y recuperación mantienen sus flujos y no se incluyen: no presentarla como copia completa de GRUK.

El descifrado valida y conserva la solicitud pero no acredita por sí solo que un movimiento pendiente exista en servidor. Al consultarlo se aplican de nuevo JWT, propietario y cuerpo exacto; si no existe, se mantiene pendiente y el reenvío explícito sigue siendo una operación financiera separada. Cerrar la pestaña/perder archivo o frase puede perder evidencia local; los registros del servidor no se borran por esa causa. No se promete pérdida imposible ni recuperación garantizada.

#407 continúa abierto: custodio independiente real, backups completos protegidos/retención/acceso/claves y restauración operacional aislada con métricas RPO/RTO, roles/índices/credenciales productivos, dispositivos físicos/compatibilidad e informe integral siguen pendientes. No sustituir estas pruebas por cifrado local. Sin merge ni Render ni cambios a main/Empresarial/Blushéa/datos reales/costos. Gates conservados.

## Siguiente paso recuperable

Verificar de nuevo HEAD/#389/#407/CI. Ampliar copia/recuperación verificable a otros diarios personales o atender el siguiente requisito prioritario con evidencia y originales conservados; no afirmar cobertura total del archivo actual. Revisar importación bajo desconexión y consultas históricas de recuperados. Evidencia externa real de custodia, retención y restauración operativa permanece necesaria antes de liberar.

## Corrección del ensayo y salvaguarda de frase

Código inicial f791073fca2d1b3161654edc2f0396c12de07eb7, árbol 4e6f90764069a89bf35d0f5795eb98392b67208e: Gate 43213914668 y Seguridad 43213914794 aprobaron. V81 43213914773 detectó un error del ensayo: page.evaluate intentaba invocar api privada de la aplicación, ReferenceError. Job 131168218928: Mongo 81/81; navegador/backend 9 aprobados/2 fallidos contando padre, no se declara verde. Se sustituye esa llamada por el flujo visible de pregunta: se exige aviso de operaciones pendientes y cero POST /consulta antes de confirmar. No se elimina la condición de bloqueo ni se abre API privada de pruebas. Repetir CI del SHA corregido.
Además se bloquean temporalmente frase, archivo y acciones de copia mientras se procesa, evitando editar la credencial durante el cifrado/descifrado; salir restablece controles en la sesión nueva. Pruebas dirigidas 27/27 aprobadas (diez de copia y diecisiete de diario), sin fallos.

## Fallo funcional detectado por Chromium y corregido

SHA 8efa6897b82c8014425ac3fb92b34d0e6b61c76d, árbol 8bafa7ea5a0918a66fd786c4a4e5f52ab818a981: Gate 43214697481 y Seguridad 43214697510 verdes; V81 43214697531/job 131170839868 falló. Mongo 81/81. La pregunta desde UI ya acreditó bloqueo y cero llamadas de asesoría, pero Chromium encontró el botón Consultar movimiento guardado deshabilitado tras recuperar: pintar corría mientras ocupado seguía true. No es solo un problema del ensayo. Se libera el estado ocupado antes del renderizado exitoso en recuperación y adopción de legado (mismo patrón); la operación ya terminó y la sesión fue comprobada. Pruebas dirigidas ahora exigen botones de consulta habilitados. Conservar los mismos límites y repetir toda la CI, sin eliminar el caso ni aumentar su timeout.

## Cierre funcional verificado

Código `ca06ee3cb804aac3d3992e256086f991dac5a464`, árbol `92a4d474659a3159974bcec7e7a43600066198fd`. Once archivos exclusivamente personales frente al padre inicial, árboles locales/remotos idénticos, publicaciones con expected_sha y force=false. Se conservaron diagnóstico y correcciones de ambas CI fallidas.

- [Gate 43215469749](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43215469749): success.
- [Seguridad 43215470076](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43215470076): success.
- [V81 43215469818](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/actions/runs/43215469818): success, ocho jobs.
- Job autorizado 131173477022: Mongo 81/81 y navegador/backend 11/11, cero fallos/cancelaciones/omisiones.
- FP_COPIA_MANUAL: cifrado AES-256-GCM, fuentesReales=101, solicitudPendiente=true, descargaReal=true, otraPestana=true, otraCuentaRechazada=true, fraseErroneaRechazada=true, originalesIntactos=true, archivoExacto=true, idempotencia=true, cambiosPosterioresConservados=true, cajaSinCambios=true, sinReenvio=true, consultaExplicita=1, asesoriaBloqueadaAntesDeConfirmar=true, datos=sinteticos.
- Local inicial módulo 665/656/9 y CI personal 353/349/4; diez pruebas nuevas de copia y 27 dirigidas después de las correcciones, cero fallos. Omisiones locales declaradas; integración autorizada completa sin omisiones. Sintaxis/diff correctos.

No se eliminó escenario, elevó timeout ni desactivó gate para aprobar. La consulta después de recuperar está habilitada y la misma corrección evita bloquear la consulta tras adoptar legado. Campos de frase/archivo y acciones permanecen bloqueados durante el proceso y se restablecen para la sesión siguiente.

No se ha probado custodia/retención independiente, restauración de producción ni dispositivos físicos. Paquete local no es backup completo de GRUK ni certificación externa; #407 sigue abierto. El SHA documental y sus runs exactos se identificarán en el resumen de #389 al cierre, sin autorreferencia dentro de su propio contenido. Siguiente: otros diarios personales y recuperación bajo desconexión/constancias históricas, manteniendo límites de alcance explícitos. Sin merge a feature ni despliegue Render ni cambios a otros productos/datos reales/costos.
