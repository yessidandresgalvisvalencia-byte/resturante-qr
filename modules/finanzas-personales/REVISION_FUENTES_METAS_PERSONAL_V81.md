# Revisión privada de fuentes originales de metas — r94

## Plan y base recuperable

El13 de noviembre de2026 se revisaron PR389 abierto/no fusionado, HEAD83dcd0941a1ce22b33577d603ca50b0f6148bd96/árbol411dfe4b3dcb89e8a10cb797c91a90df5546302c y feature/finanzas-personales652126a03f19fbec3c529cad1e84bff11cd3699e. CI padre Gate43416306149/Seguridad43416305684/V8143416305595 success. #407 es issue abierto; no se interpreta como PR ni como resuelto. No se encontró AGENTS.md local adicional; se consultaron README, matriz y continuidad del módulo.

Un bloque funcional: revisión de formato y nombres de fuentes de metas propias cuando el listado normal se cierra por legado ambiguo. Se conserva cada fuente original, se muestran sus hallazgos sin omitirlos ni elegir qué dato reemplazar. No corrige, adopta, elimina, restaura ni inventa historia o efectivo. La auditoría contextual de otros flujos continúa pendiente; no se declara completada.

## Aceptación e implementación

1. GET /metas/revision-fuentes usa únicamente dueño del JWT y query pagina estricta1–25; private,no-store, sin elegir usuario/ID arbitrario.
2. Snapshot MongoDB con lectura nativa BSON, sin pasar por conversión del modelo ni guardar documentos. Huella SHA256 sobre cada buffer BSON recibido, identidad de fuente y valores escalares acotados. El original permanece en Mongo; la huella identifica bytes de esa lectura, no firma ni certifica custodia externa.
3. Reporta nombre inválido/equivalente por NFKC/espacios/mayúsculas entre todas las páginas, objetivo no positivo/entero seguro, acumulado inválido/mayor al objetivo, estado/fecha no verificables y marcas de creación incompletas. No interpreta texto como fecha ni redondea dinero. Fecha Date antigua válida no se transforma en error por estar vencida.
4. Reporte explícitamente limitado a FORMATO_Y_NOMBRES_DE_FUENTES_META: no verifica recibos, cadena, estado actual, origen del saldo, efectivo ahorrado ni ausencia de problemas en campos no revisados. SIN_MARCAS_CREACION significa ausencia de esas marcas en fuente, no prueba de ausencia de recibos/eventos. Una fuente con marcas válidas tampoco acredita su recibo. Ningún informe autoriza reparación, adopción o gasto.
5. Máximo500 fuentes por dueño y8MiB BSON retenidos por lectura,20por página, consulta5segundos y fallo cerrado de capacidad. El límite de bytes aplica al material retenido por la aplicación; no certifica memoria máxima de buffers/red del driver. Más de500 requiere estrategia posterior específica sin borrar/podar. No se devuelve reporte parcial como completo. La lista de tipos/valores de diagnóstico no es una exportación recuperable de todos los originales.
6. UI accesible mediante consulta explícita aunque el listado normal falle; conserva formulario, muestra texto mediante textContent y no agrega botones de reparación. Separación de estado y contador de consulta impide repintar desde otra sesión o consulta superada. Se limpia el informe al salir/fallar; no se limpia la fuente.
7. Verificar HTTP/Mongo autorizado, aislamiento, BSON antes/después, ausencia de recibos/cursor/eventos nuevos, paginación/501, interfaz390 y texto literal, además de regresiones. Las pruebas locales no sustituyen esos ensayos.

## Validación inicial y checkpoint

Nueve pruebas nuevas puras/handler/UI aprobadas; sintaxis de servicios y fixtures correcta. Ensayo Mongo añadido al job autorizado y caso Chromium añadido al backend real; pendientes antes de declarar bloque completo. No se amplía timeout ni se desactiva gate. No cambian colecciones protegidas25 ni formato de respaldoV24/44; la revisión es solo lectura. Prueba de conservación usa comparación BSON exacta y fotografía financiera antes/después; también comprueba que el listado normal siga fallando cerrado frente a fuentes inválidas.

Revisado gastoInteligentePersonal.service.js: conservar horizonte futuro/importe verificable, saldo y obligaciones conciliadas y snapshot válido; no repetir esa implementación ni recomendar compra con datos desconocidos.

Publicar en integration/fp-hormiga-clasificacion-credito-v81 con expected_sha/force=false y árboles iguales, verificar CI del SHA exacto, corregir fallos y anexar evidencias. Leer HEAD/plan/CI de nuevo antes del siguiente lote. Próximo: decidir un flujo explícito de resolución de legados ambiguos con preservación y compensaciones cuando proceda, sin usar este diagnóstico para modificar datos; ampliar auditoría contextual de otros flujos.

## Límites globales de liberación

Continúan #407, custodio independiente real, respaldo/restore operacional independiente con retención/acceso/credenciales separadas y RPO-RTO medidos, roles/índices/migración históricos productivos, configuración de claves, proxy/rate limit real, Safari/dispositivos físicos y auditoría independiente cuando corresponda. No se crean evidencias externas ni garantías absolutas. Sin merge a feature/main ni despliegue Render, costos nuevos, restauraciones productivas u otros productos modificados.


## Corrección de fallo CI r94
Primer código6d92c4bce98f705595bd0726a2f2cc9fe1afc05e/árbol a8e5adc14d42620e4274ff65f6a7c584a5805ce3: job131867185291 de V8143419959393 falló el contrato no-store de una petición sin sesión, interceptada antes del handler por autenticación. Mongo87casos/85aprobadas/2fallos contando padre; no se declara verde ni se atribuye evidencia al caso nuevo incompleto. Se agrega cabecera privada para esa ruta GET antes de auth/entitlement, conservando validación y permisos. No se relaja la aserción, timeout ni gate. Nuevo SHA y CI exacta pendientes.
