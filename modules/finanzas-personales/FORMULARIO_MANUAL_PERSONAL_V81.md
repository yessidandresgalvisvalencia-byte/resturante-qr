# Formulario manual recuperable — r87

## Plan y alcance

Un bloque funcional: conservar y recuperar el formulario manual aún sin enviar, aislado por propietario, incluyendo copia cifrada y protección de ediciones durante operaciones en vuelo. No se repite el archivo de diarios ni los borradores de restauración ya completados. No se cambian rutas, cálculos monetarios, MongoDB, dependencias o gates.

Partida comprobada: PR #389 abierto y sin fusionar, HEAD `e4c992a635ada400325c30a88d863a570e2e6b17`, árbol `9655cddf1c4fafabfbc7353625b4af880458bd8e`. Base `feature/finanzas-personales` en `652126a03f19fbec3c529cad1e84bff11cd3699e`; única rama de escritura `integration/fp-hormiga-clasificacion-credito-v81`. CI inicial exacta success: Gate43341720291, Seguridad43341720347 y V8143341720418. #407 es un issue abierto, con seis criterios y sin nueva evidencia externa de cierre. Instrucciones y continuidad revisadas; no hay AGENTS.md en el snapshot del repositorio. Gasto inteligente/horizonte estricto ya constan resueltos en continuidad, sin reimplementación.

## Criterios y comportamiento

| Criterio | Resultado implementado |
| --- | --- |
| Formulario completo | Tipo ingreso/gasto, monto como texto literal sin calcularlo, concepto, categoría, subcategoría, cuenta, medio, contraparte, descripción, fecha y recurrencia. Sin JWT, claves financieras, saldos ni autorizaciones |
| Parciales | Permite campos incompletos y monto textual para continuar edición. No es un asiento ni autorización: envío mantiene validación estricta de pesos enteros positivos, fecha no futura y crédito/gasto protegido. Contratos, opciones, fechas imposibles, controles y longitudes inválidas se rechazan |
| Propietario | Un formulario actual por usuario en su diario manual. Renovar JWT del mismo usuario conserva; cambiar de dueño limpia todos los campos y tipo/opciones, repone solo su propio formulario. No hay poda al salir |
| Persistencia verificable | Cada edición input/change y selección de tipo guarda con lectura posterior exacta. Antes de preparar se vuelve a guardar. Cuota o escritura ignorada bloquea preparación; texto visible y raíz previa se conservan. No se afirma persistido lo que falló |
| Separación financiera | Escribir, recargar, entrar o recuperar copia no prepara solicitudes ni llama API. Borrador solo no bloquea C3 como si fuera una operación enviada. Pendiente real o legado mantienen sus bloqueos |
| Ediciones en vuelo | Preparación asíncrona verifica formulario y sesión antes de crear pendiente. Confirmar solo limpia monto/concepto si TODOS los datos actuales coinciden con el cuerpo confirmado; texto nuevo en vuelo permanece. Fallo al guardar el cierre repone el formulario visible y advierte consultar diario |
| Copia compatible | Nuevo `FP_DIARIO_LOCAL_V2` incluye formulario y originales/páginas en el cifrado existente AES-GCM/PBKDF2. V1 previa sigue aceptada sin formulario; downgrade con campos nuevos o contrato incoherente se rechaza. Raíz sigue versión1/2 de páginas, distinta de versión portable |
| Recuperación | Reposición sin red ni envío. Otro dueño, frase errónea, diario distinto o copia alterada no sobrescriben originales. Reimportar copia conocida conserva ediciones/estados posteriores. Edición durante lectura o cambio de sesión impiden reemplazo |
| Archivo | Página de 100 solicitudes cerradas conserva también formulario y original íntegro; copia V2 y restauración mantienen ambos. Límites previos de 20 páginas y 100 solicitudes activas sin limpieza automática |
| Confirmación | Envío normal, confirmación recuperada, resolución de pendiente y cierre histórico/legado reutilizan cierre coincidente del formulario. Solicitud, UUID, cuerpo y constancia originales permanecen intactos; no se transforma borrador nuevo en movimiento anterior |

El formulario es estado mutable de edición; reemplazarlo por la siguiente edición del mismo usuario no constituye historial financiero append-only. Los cuerpos enviados y fuentes financieras conservan sus propias reglas de integridad. El texto del monto no se convierte en número para almacenarlo ni se usa para calcular saldos.

## Validación reproducible

```bash
node --test test/finanzas-personales/formularioManualPersonal.test.js test/finanzas-personales/copiaDiarioManual.test.js test/finanzas-personales/archivoDiarioManual.test.js test/gruk/frontend-version-aislamiento-personal.test.js test/gruk/hormiga-version-javascript-personal.test.js
node --test test/finanzas-personales/*.test.js
npm run ci:personal
# Solo en runner con MongoDB autorizado de pruebas aisladas:
node --test test/finanzas-personales/browser/backend-recuperacion.browser.cjs
```

Diez pruebas nuevas cubren contrato, propietario/JWT, parciales y rechazo de envío inválido, persistencia fallida, copia V2/V1 y downgrade, recarga/cambio de sesión, input/change, preparación concurrente, cierre coincidente frente edición nueva, importación tardía/edición y archivo de 100 originales.

Resultados locales: nuevas10/10, módulo790 totales/781 aprobadas/9 omitidas, ci:personal353 totales/349 aprobadas/4 omitidas, cero fallos. Node24 local; CI usa Node20. Omisiones por servicios externos no acreditan operación. Sintaxis de JavaScript personal y runner aprobada. Dirigidas finales y CI exacta se registran al cierre.

Ensayo nativo ampliado dentro del caso de copia manual ya existente: origen con 101 solicitudes reales sintéticas conserva aparte un borrador de gasto777 aún sin enviar. Recarga, exportación V2, otro dueño rechazado, recuperación offline en otra pestaña, tipo y todos los campos exactos, ancho390, cero POST financieros, consulta explícita del pendiente anterior y conservación del borrador distinto tras confirmar. Nueva evidencia `FP_FORMULARIO_MANUAL`; siguen todos los casos anteriores, sin relajar cuotas, timeouts o gates. Pendiente ejecución autorizada para SHA publicado; no se afirma ejecutado localmente.

## Límites y continuación

sessionStorage puede agotarse o perderse si el usuario borra datos del navegador. No es backup independiente ni custodia externa; frase perdida no recuperable. Capacidad portable8MiB, archivo cifrado12MiB, raíz/página512KiB. No se fusionan automáticamente diarios distintos ni se prometen recuperación garantizada, seguridad absoluta o escala de un millón de usuarios.

Siguiente: revisar cobertura completa del formulario manual con fallos de conexión/cierre y luego matriz de aceptación final del módulo para escoger brechas funcionales reales; evitar seguir agregando archivos equivalentes sin necesidad. #407 sigue bloqueado por evidencia independiente real, custodia/backups protegidos/retención/acceso/credenciales separadas, restauración operativa aislada con RPO/RTO, permisos e índices productivos, compatibilidad y dispositivos físicos/auditoría cuando corresponda. Pruebas sintéticas no sustituyen esas verificaciones.

Publicación con árbol local/remoto idéntico y expected_sha/force=false. Sin fusión a feature ni main, sin Render, otros productos, costos o datos reales alterados. Mantener checkpoint recuperable y tarea activa; no prometer ejecución ininterrumpida.
