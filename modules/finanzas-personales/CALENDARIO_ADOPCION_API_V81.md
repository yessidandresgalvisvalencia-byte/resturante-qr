# Adopción explícita de calendarios anteriores — API V81

2026-11-05, Colombia. Base remota revisada: `a202514067747d5261db542294f0f091fd2ec59e`, árbol `ac024c9e10ac6685a65844b8ebf5303f4f692c50` idéntico a la copia local antes de editar. #389 abierto sobre feature/finanzas-personales (`652126a03f19fbec3c529cad1e84bff11cd3699e`); #407 abierto. CI del padre: Gate 42079382059, Seguridad 42079382116 y V81 42079381829, success.

## Alcance funcional

La API permite adoptar un calendario INGRESO mensual existente mediante confirmación explícita del propietario autenticado. No genera un ID nuevo: usa el ID original. No actualiza ni elimina la fuente, no registra dinero recibido y no modifica cuentas, transacciones o outbox. El original permanece consultable y se conserva una copia BSON completa dentro del evento inicial ADOPTAR, con huella SHA256. Base64 es codificación, no cifrado; protección de acceso, cifrado operativo y custodia independiente siguen sujetos a los gates de producción.

Contrato:

1. GET /calendario-ingresos devuelve originales propios, fuenteHuella y adopcionDentroDeCapacidad. Conserva todos los campos de la fuente en la vista. Una fuente demasiado grande sigue visible; solo su adopción queda fuera de capacidad.
2. POST /calendario-ingresos/:id/eventos usa la misma ruta autenticada/limitada de eventos. Cuerpo exacto: solicitudId estable y solicitud con accion ADOPTAR, confirmacion true, versionEsperada 0, motivo de 8–240 caracteres, fuenteHuella exacta y datos {concepto,montoMinor,diaMes,fechaProxima}. Los tres primeros datos deben coincidir con el original válido; la próxima fecha es explícita, corresponde al día mensual (recortado al fin de mes) y queda entre hoy colombiano y 31 días. No se copia una fecha o recepción histórica. Corregir el monto después requiere un nuevo evento CORREGIR.
3. GET /calendario-ingresos/recibos/:clave recupera el recibo vinculado a solicitud/identidad/huella. Reenviar la misma solicitud conserva el recibo original incluso después de pasar la fecha prevista; cambiar el cuerpo con la misma clave se rechaza. El recibo no certifica estado actual.
4. Historial conserva el BSON en fuenteOriginal, su hash encadenado y el estado anterior/posterior. La huella incluye la copia opcional solo para nuevos eventos ADOPTAR; los eventos antiguos sin ese campo conservan exactamente su algoritmo/hash.

El estado activo/inactivo original se conserva al adoptar. Una adopción inicialmente inactiva se restaura solo con referencia exacta al hash de esa adopción, sin tocar la fuente. Retirar/restaurar después usa eventos y versiones normales. La procedencia adoptada se mantiene al corregir.

## Integración y límites

Home y proyección leen fuente/eventos en una misma transacción snapshot. Sustituyen la fuente adoptada por la versión gestionada exactamente una vez por ID. El conjunto de fuentes sustituidas incluye calendarios retirados: retirar no hace reaparecer el original activo. Restaurar no duplica planificación ni genera caja. La proyección pasa de repetición legada mensual a una sola fecha explícita del calendario gestionado. Se conserva sourceId histórico; no se elimina el control de procedencia de Home/proyección.

Cada lectura verifica que el original adoptado siga presente, pertenezca al propietario y conserve su huella completa. Ante alteración administrativa, ausencia o corrupción, falla cerrada; no repara ni reactiva fuentes. El rol de aplicación ya está restringido contra UPDATE/DELETE del original. Una credencial administrativa puede alterar la fuente concurrentemente: una lectura snapshot conserva la vista anterior y la siguiente detecta la diferencia. No se promete bloquear a un administrador ni se oculta esa limitación con una supuesta garantía de inmutabilidad absoluta.

Se acotan copias a 32768 bytes BSON, 500 adopciones por propietario, 5000 eventos totales y 1000 por calendario, además de los límites ya existentes. BSON conserva fechas, ObjectId, binarios y Long históricos; se solicita promoteLongs:false para no convertirlos silenciosamente antes de capturar/verificar. Fuentes inválidas o representaciones BSON que no permitan roundtrip idéntico no se adoptan. No se deducen identidades por nombre/monto ni se resuelve automáticamente duplicación semántica entre documentos originales distintos.

No se agregan colecciones, índices, roles ni migraciones. Modelo de eventos añade campo opcional; las veinte colecciones protegidas y backup V18 de 38 colecciones no cambian. La copia y el original deben quedar juntos en los respaldos existentes.

La interfaz reconoce y vincula originales ya adoptados con su calendario gestionado y los muestra como evidencia, sin contarlos otra vez. Los assets personales usan 20261105-calendario-adopcion-v81; CSS/service worker sin cambios. El botón/formulario recuperable para iniciar adopción aún está pendiente: este bloque entrega API e integración, no afirma haber completado ese flujo visual.

## Matriz de aceptación y pruebas

| Criterio | Evidencia preparada |
| --- | --- |
| Confirmación, versión cero, motivo, datos exactos y fuente/propietario válidos | Validación pura y handler, HTTP autenticado con rechazo de propietario en JSON, otro usuario 404 y huella incorrecta 409 |
| Original íntegro y tipos BSON | Copia con metadatos Long/fecha/binario; comparación de codificación/huella y originales antes/después |
| Sin duplicación | Dos solicitudes simultáneas con misma clave y dos claves distintas sobre un original: un evento inicial; replay recuperable; otra adopción rechazada |
| Fallo atómico | Error de inserción de evento deja cuenta, fuentes, ledger, outbox e historial sin cambios |
| Retiro/restauración | Original activo permanece intacto; planificación cero durante retiro, una al restaurar; original inactivo conserva estado hasta restauración explícita |
| Home/proyección | Un único monto previsto; ventanas explícitas 30/60/90 sin repetición mensual adoptada; ninguna recepción inventada |
| Corrupción/concurrencia externa | Snapshot previo consistente; siguiente consulta/proyección/Home rechazan original alterado, sin reparación |
| Cadena y capacidad | Copia/huella/propietario/importe adulterados, aun rehasheados, rechazados; fuentes grandes continúan consultables |
| Compatibilidad de interfaz | DOM muestra original adoptado, exige vínculo de huella con gestionado; regresiones de captura y calendario conservadas |

Pruebas nuevas: calendarioAdopcion.test.js y helpers/calendarioAdopcionAutorizada.js conectado a privilegiosLedgerMongoV81.integration.test.js. Se usan únicamente fixtures en Mongo local autorizado de CI y JWT de prueba. No hay credenciales o datos reales en los fixtures.

Local Node24: módulo completo y dirigidas ejecutados; resultados exactos y CI Node20 del SHA publicado se registran al cerrar. No se ejecuta Mongo local ni se inventa su resultado antes de CI. No hay evidencia de dispositivos/navegador visual en este bloque.

## Siguiente paso y liberación

Completar interfaz de adopción: selección de original y huella visibles, confirmación explícita, petición exacta conservada antes de POST, recibo recuperable tras respuesta perdida, misma clave y aislamiento de sesión; no inventar fecha prevista. Después, recepción por ocurrencia sin duplicar caja. Preservar pruebas de gastoInteligentePersonal: horizonte futuro y fuentes completas; ya se revisaron, sin rehacer sus correcciones previas.

#407, custodio independiente real, respaldo durable completo/retención/acceso/claves separados, recuperación operativa aislada/RPO-RTO productivos, roles/índices/históricos reales, seguridad/compatibilidad/visual-dispositivos e informe final permanecen pendientes. La demora y fecha productivas aún requieren medición real. Sin merge a feature, cambios en main/Empresarial/Blushéa, Render, costos nuevos ni escritura/borrado/restauración de datos reales.

Validación local previa a publicación: Node 24.22.1, 496 casos del módulo/487 aprobados/nueve omitidos/cero fallos; 37 dirigidas de Home, versiones, privilegios y respaldo aprobadas. Sintaxis general, nuevas fuentes/helper y diff correctos. Auditoría estática sin estos patrones de mutación; mantiene su advertencia y el gate independiente de #407. CI Node20/Mongo autorizado todavía debe confirmarse para el SHA publicado.

## Evidencia del núcleo publicado

Núcleo `573b7f9f3938d7cdffd350b0f3e27d1e02378ef8`, árbol `1a96548484df030bc9287c8e29e8d8c6f246931f`. Gate 42089560090, Seguridad 42089559930 y V81 42089559920: success para ese SHA. Job Mongo autorizado 127463730385: 68 pruebas/68 aprobadas/cero fallos; el subtest de adopción HTTP/BSON/planificación única aprobó. Diecisiete blobs remotos cotejados y árbol idéntico a la copia probada. Local final: 496 casos/487 aprobados/nueve omitidos/cero fallos, más 37 dirigidas aprobadas; Node20 de CI confirmó compatibilidad frente al Node24 local.

Ensayo V18: 38 colecciones/5350 documentos/3481570 bytes, captura 188 ms, restauración 928 ms, edad 1101 ms; custodiaIndependiente=false y rpoProduccion=false. Restauración BSON/índices en base aislada de fixtures; no reparación de corrupción, recuperación productiva ni evidencia de custodia durable. Modelo/roles/índices/alcance del backup sin migraciones nuevas.

Un bloque de API e integración completado; su cierre documental descendiente requiere CI exacta y no cuenta como bloque adicional. Próximo bloque: interfaz de adopción con confirmación y solicitud recuperable; aún pendiente aprobación visual/dispositivos. #407, custodio real y gates operativos permanecen abiertos. Sin merge a feature ni Render; ningún dato real alterado.
