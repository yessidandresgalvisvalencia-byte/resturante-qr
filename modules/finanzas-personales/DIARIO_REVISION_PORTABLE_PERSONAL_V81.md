# Diario portable de revisión de cobros — r110

19 de noviembre de2026 (Colombia). Padre realdbbabbb8644bbed5efb059ce84d3a43c42f98857/árbol2e5fb64d7b8c46e0b251f8093c4be3098e6e3624; PR389 abierto/no integrado hacia feature652126a03f19fbec3c529cad1e84bff11cd3699e en integration/fp-hormiga-clasificacion-credito-v81. Issue407 abierto/sin evidencia externa nueva. Padre Gate44641311706/Seguridad44641311694/V8144641311780 success; ocho jobs,Mongo101/101 y Chromium/backend32/32 sin omisiones. Instrucciones/continuidad revisadas, sin AGENTS.md adicional. Fechas/compra inteligente y bloques de recibo/historial ya cerrados, no se cuentan de nuevo.

## Bloque y plan

Un bloque completo: diario local propio y copia portable cifrada de solicitudes/resultados de revisión, con recuperación sin repetir operaciones. Incluye integración antes de enviar, adopción estricta de pendientes anteriores, bloqueo C3, comprobación de recibos y UI de exportación/importación. No modifica API financiera, MongoDB, modelos/índices, permisos ni formatos de respaldo del servidor.

- Diario separado por propietario, gruk.fp.revisionesTrabajo.v1:<usuario>. Antes de enviar nueva revisión conserva idempotency key/cuerpo/version/huella y la representación original del pendiente. Nunca guarda JWT, frase o headers de autenticación. Adopta pendientes del control existente solo si conservan contrato y hash exactos; no inventa cuerpo perdido ni cambia claves. La adopción valida todo antes de escribir, sin reemplazar operaciones anteriores.
- Entradas PENDIENTE, CONFIRMADA o NO_APLICADA. Conserva primer recibo/respuesta original, solicitud original y estados posteriores; una consulta repetida con el mismo hash no reemplaza esos originales por el acuse de replay. Datos cruzados/recibo distinto fallan. El cuerpo y la huella coinciden con contrato real del servidor. Un resultado NO_APLICADA propio puede cerrar la solicitud sin caja; rechazos sin recibo conservan incertidumbre.
- Recuperar una copia en destino vacío conserva su raíz original completa en archivo local direccionado por SHA256, más sus originales anteriores y acuse de recuperación; crea una proyección activa separada. Todas las entradas recuperadas pasan por porVerificar, incluso las cerradas: no se usa un estado importado como prueba nueva del servidor. Solo GET de recibo propio coherente elimina esa obligación. El estado histórico original de la copia no se reescribe.
- Nueva interfaz en Deudas permite descargar copia, importar y listar solicitudes por verificar, con confirmación explícita y frase de16–256 caracteres que se limpia del formulario. Cifrado reutiliza el mecanismo existente AES-256-GCM/PBKDF2-SHA256/600000 iteraciones/sal e IV aleatorios; versión/alcance/propietario interiores estrictos. No es copia de MongoDB, otros diarios ni cuenta bancaria. No se guarda ni recupera la frase. Archivo máximo12MiB, plano8MiB.
- Importar no llama a la API ni reenvía revisiones. Un diario distinto existente se rechaza antes de escribir; copia repetida reconocida conserva confirmaciones posteriores y no reabre solicitudes. Origina bloqueo de recomendaciones C3 aunque no exista el diario genérico de mutaciones. Consulta de recibo desde copia/historial/acción original cierra solamente la solicitud coincidente, sin pagos ni otro POST.404 no prueba que nunca se ejecutara; no se cierra por leer saldo.
- Conserva originales locales ante escritura ignorada/cuota/operación interrumpida y permite completar la recuperación cuando aún no se activó la raíz. Antes de sobrescribir se comprueban estado, propietario y vigencia; respuestas tardías de otra sesión no confirman ni muestran datos. No fusiona paquetes arbitrarios ni retira entradas automáticamente.

## Aceptación

| Criterio | Validación requerida |
| --- | --- |
| Preservación | Solicitud/primer recibo/respuesta exactos; adopción de legado y repetición sin cambios; original completo archivado al recuperar |
| Criptografía/alcance | Cifrado diferente por sal/IV; frase/usuario/alcance/archivo alterados rechazados, sin escrituras ni datos en claro en archivo |
| Idempotencia | Importación repetida tras GET no reabre pendientes; otra copia local no se reemplaza; acuses/originales conservados |
| Fallos/límites | Escritura ignorada y sesión tardía fallan sin retirar originales;100 entradas y capacidad de originales fallan de forma explícita |
| C3/recuperación | Copia importada bloquea asesoría sin diario genérico, incluso si guardaba recibos cerrados; GET propio cierra, no hay POST automático |
| Navegador | Chromium390 descarga cifrada, rechaza usuario ajeno, importa en pestaña nueva, verifica GET e importa otra vez sin duplicar/cambiar caja |
| Trazabilidad | SHA/tree/lease, CI exacta, evidencias y límites/siguiente paso versionados; sin merge/Render |

## Límites y siguiente paso

Máximo100 entradas por raíz, conservadas también después de cerrar, y20 originales locales; un paquete exportable admite hasta19 originales para dejar capacidad de conservar su raíz al recuperar. Al alcanzar capacidad no se descarga una copia no recuperable ni se borra contenido. Falta archivo no destructivo de revisiones cerradas para continuar creciendo: siguiente bloque prioritario, con visualización/recuperación de originales y copia completa. Después diagnóstico/adopción de orígenes legacy/otros conceptos, contexto deuda/crédito y metas ambiguas.

El diario activo y sus originales locales residen en sessionStorage, no en custodia externa. Cerrar/perder esa pestaña sin descargar copia puede perder ese material local; recibos ya persistidos siguen localizables en el historial del servidor. La recuperación necesita archivo y frase; no se garantiza si faltan, están corruptos o el dispositivo está comprometido. La validación de estructura/hash local y el cifrado no son firma externa ni identidad verificada del dispositivo; el recibo se consulta autenticado antes de cerrar la obligación recuperada. No se garantiza protección ante un administrador/atacante con control completo del navegador o de todas las credenciales.

#407 sigue abierto: custodio independiente real/anclas, backup durable/retención/accesos/claves separados y restauración operativa/RPO-RTO, permisos/índices/migración/configuración reales, Safari/dispositivos y auditoría independiente según matriz, compatibilidad/informe final. No se amplían costos ni contratan servicios. Sin merge/Render/main/Empresarial/Blushéa o datos reales alterados. Tarea activa.

## Validación en curso

Primer ensayo local dirigido5 casos/3pass/2fail: dos fixtures regeneraban un recibo distinto al simular GET, con fecha/contexto/hash nuevos. Se corrigió el fixture para usar el mismo recibo original con duplicado:true, manteniendo el rechazo de hash distinto. Producto no se relajó. Dirigidas finales de portable8/8, con límites y UI sin POST. Módulo previo934/925pass/9 omisiones externas/0fallos (antes de agregar el caso adicional de capacidad); ci:personal353/349pass/4omisiones/0fallos; caché/integración7/7 solapadas; sintaxis/diff correctos. Nuevo ensayo nativo extiende el caso existente sin aumentar32casos ni120s. CI del SHA nuevo pendiente: no declarar cierre hasta completar. SHA del cierre por Git/PR sin autoreferencia circular.

Validación final previa a publicación r110:módulo936 casos/927pass/9omisiones externas/0fallos tras agregar capacidad y sesión tardía; ci:personal353/349pass/4omisiones/0fallos, portable8/8 y caché7/7 solapadas, sintaxis/diff correctos. Mongo/browser del nuevo SHA pendientes; sin merge/Render.
