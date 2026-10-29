# GRUK Finanzas Personales — liberación segura de gastos hormiga V81

**Alcance:** únicamente la rama `feature/finanzas-personales` y el servicio Render `srv-dav8md7pn0mc739khig0`. **No modificar `main` ni GRUK Empresarial.**

## Estado de partida

- Último deploy confirmado `live`: `fb83d3ead474bd28c9de63d151556e4863da6f69`.
- La fusión #378 (`f44a0535ad86ac7f10a90be6a700cfc8618a43e0`) no llegó a producción. Es un fallo histórico; la capacidad de compilación actual debe comprobarse de nuevo, sin asumir que sigue agotada.
- Cambios pendientes: #380 (clasificador), #381 (caja, crédito y controles), #389 (integración y regresiones conjuntas). #389 **no debe publicarse junto a #380 y #381 mediante fusiones duplicadas**; escoger una secuencia final de un solo conjunto validado.
- **No habilitar pagos, alterar gasto máximo ni aumentar el plan de Render sin autorización expresa del titular.**

## Puerta 1 — disponibilidad de compilación

Antes de fusionar, comprobar en Render que existan minutos de compilación disponibles. Si no hay capacidad, conservar PR abiertos: un GitHub Actions verde **no demuestra un despliegue**. No forzar repetidos deploys.

## Puerta 2 — compatibilidad de datos históricos (solo lectura)

`TransaccionPersonal` declara `impactoCaja: {type:Boolean,default:true}`. El valor predeterminado de Mongoose **no reescribe automáticamente** todos los documentos históricos. El resumen nuevo requiere un booleano `true` explícito para confirmar salida de caja en EFECTIVO, DEBITO, TRANSFERENCIA, PSE u OTRO. Un campo ausente o nulo produce `INTEGRIDAD_HORMIGA`, no un falso cero. `CREDITO` se conserva separado de caja aunque `impactoCaja` sea `true` por defecto.

Con credenciales de lectura autorizadas, auditar el período que realmente consulta el resumen, **sin imprimir importes, conceptos, correos, IDs de usuario ni documentos**. Utilizar una consulta equivalente a esta en una consola de MongoDB de solo lectura autorizada (el período debe cubrir desde el comienzo del mes o los siete días, el que empiece antes):

```javascript
const desde = ISODate("2026-10-01T05:00:00Z"); // EJEMPLO; resolver por calendario America/Bogota
const hasta = new Date(); // usar el instante real de auditoría
const medios = ["EFECTIVO","DEBITO","TRANSFERENCIA","PSE","OTRO"];
const filtro = {
  tipo:"GASTO", estado:"ACTIVA", fecha:{$gte:desde,$lte:hasta},
  medioPago:{$in:medios},
  $or:[{impactoCaja:{$exists:false}},{impactoCaja:null}]
};
db.fin_transacciones_personales.countDocuments(filtro);
```

La cifra anterior es solo un **indicador de compatibilidad, no equivale a gastos hormiga afectados**: incluye gastos de otras categorías y no mide el porcentaje exacto de usuarios bloqueados. Si el conteo es mayor que cero, analizar por qué falta la marca mediante conciliación autorizada, sin inferir salidas ni actualizar registros automáticamente. Definir una transición auditada y probarla en un entorno aislado sin sobrescribir los asientos originales; por diseño la aplicación debe **fallar cerrada** ante datos inciertos.

## Puerta 3 — pruebas de integración

1. Combinar los cambios del clasificador y el resumen **una sola vez** sobre la rama personal, sin modificar `main`.
2. Confirmar GitHub Actions: seguridad, precisión e integridad V81 y GRUK Gate todos `success` para **el commit exacto a desplegar**.
3. En una cuenta de ensayo, registrar solo movimientos ficticios: Rappi de caja, Rappi con crédito, café, cafetera, arriendo, pago de tarjeta, una anulación y una repetición por idempotencia. Comprobar que consumo = caja + crédito, promedio diario reconciliado, cuentas separadas, visibilidad por usuario, ventana Bogotá y banner cuando falla la consulta.
4. Comprobar que el HTML referencia exactamente la versión del JS incluida en el commit candidato; recargar en sesión antigua y nueva. No usar una versión de caché copiada de una liberación anterior.
5. Ejecutar verificación de índices/plan de consulta (`explain`) con usuario de pruebas. El índice en el esquema no demuestra que ya exista en producción.

## Puerta 3B — bloqueo explícito de certificación append-only

El [bloqueo #407](https://github.com/yessidandresgalvisvalencia-byte/resturante-qr/issues/407) sigue abierto. Sus ejemplos de `Object.assign(anterior, ...)` y cambios de `tx.estado` describen el hallazgo original, no el estado actual del PR #389. Las rutas de corrección/anulación ya usan eventos compensatorios y el modelo original bloquea modificaciones por Mongoose. Esto no demuestra por sí solo la inmutabilidad del despliegue real.

| Criterio de #407 | Evidencia disponible en el PR | Pendiente para liberar |
| --- | --- | --- |
| Preservar originales | Eventos compensatorios; hooks del modelo; pruebas de conservación de fuentes | Verificar las cinco colecciones con las credenciales reales y revisar accesos por driver nativo, scripts y otras credenciales |
| Atomicidad e idempotencia | Transacciones MongoDB para evento, caja, reservas y outbox; reintentos probados | Confirmar compatibilidad de todas las rutas de escritura con el rol real y los datos existentes |
| Cadena y concurrencia | Cadena completa y cursor verificados antes de anexar y responder reintentos; pruebas de huecos y adulteración | Definir e implementar custodia independiente para el historial compensatorio y demostrar su verificación; SHA256 local no impide una reescritura coherente por un administrador |
| Históricos sin reescritura | Migración v1 por inserciones, repetición, reconciliación por fuente y rollback probados | Auditar compatibilidad y alcance de históricos reales; la migración v1 no reconstruye vínculos de cuenta ni prueba completitud histórica |
| Regresiones financieras | CI con replica set y autorización: aislamiento, saldos, rollback, conservación de fuentes y reintentos | Revisar evidencia del SHA final y ejecutar ensayo con datos ficticios; no sustituir las pruebas con casos omitidos |
| Gate y despliegue | `--enforce` conserva bloqueo; servicio y SHA live identificados | Revisar evidencia externa, configurar/verificar salud HTTP y confirmar el SHA candidato live y su comportamiento antes de anunciar disponibilidad |

Comprobar el estado de la búsqueda limitada de patrones:

```bash
node scripts/gruk-personal-ledger-mutability-audit.js
node scripts/gruk-personal-ledger-mutability-audit.js --enforce
```

`--enforce` **siempre termina con código 1 en esta implementación**, incluso si no encuentra patrones. Es un bloqueo deliberado por evidencia externa pendiente; no es una suite de regresiones ni debe convertirse en éxito cambiando una bandera o eliminando la condición. La búsqueda recorre los archivos JavaScript regulares del módulo personal. Detecta ciertos alias de require, accesos inline y llamadas nativas con nombres literales a las cinco colecciones protegidas; mantiene los patrones históricos en sus cinco archivos originales. No resuelve scopes, alias dinámicos, métodos computados, documentos cargados, imports ESM ni procesos administrativos externos. Puede señalar texto en comentarios o cadenas y exige revisión manual; no es un análisis completo de flujo de datos.

La revisión de privilegios puede ejecutarse con la credencial real de aplicación mediante `npm run audit:personal:mongo-privileges`, en un entorno autorizado que ya tenga sus variables configuradas. No imprimir URI, claves, identidades ni documentos. El resultado `compatible: true` sigue llevando `certificaInmutabilidad: false`; no prueba que no existan otros usuarios privilegiados ni que haya custodia externa. Ver [privilegios-ledger.md](privilegios-ledger.md).

La provisión administrativa es una operación separada y requiere su propia planificación. No ejecutar `provision:personal:mongo -- --apply`, cambiar roles o migrar datos simplemente para completar esta lista. Las pruebas locales autenticadas no acreditan la configuración de producción.

Las anclas de DecisionProof, la cadena compensatoria y el outbox tienen alcances distintos. No presentar un ancla guardada con las mismas credenciales o en la misma base como custodia independiente de todo el historial. La aceptación debe identificar qué registros cubre, quién custodia el compromiso, cómo se verifica y cómo se detectan truncamientos o reescrituras.

## Puerta 4 — Render y verificación posterior

- Requerir estado de deploy **`live`**, SHA exacto y verificaciones HTTP de salud y comportamiento con cuenta de ensayo. Un deploy `build_failed` o `deploying` no es éxito.
- No migrar ni cambiar saldos reales para facilitar el despliegue.
- Si falla, detener nuevas fusiones, conservar evidencia, volver al último deploy `live` si el proveedor permite una restauración segura, y comparar datos sin editarlos.
- Registrar fecha, SHA, estado de pruebas, estado Render y responsable antes de anunciar al usuario que puede probar.

## Comprobación operativa registrada el 29 de octubre de 2026

Render informó `live` para `fb83d3ead474bd28c9de63d151556e4863da6f69`, del servicio personal enlazado a `feature/finanzas-personales`. La petición directa a `/healthz` devolvió HTTP 200 y el identificador del servicio; no acredita índices, permisos ni integridad financiera. La configuración de Render tenía `healthCheckPath` vacío. La consulta de logs de nivel error no devolvió entradas en la ventana retornada, sin demostrar ausencia de errores.

Antes de liberar, volver a comprobar estas observaciones. Los cambios del PR #389 no estaban desplegados en esa verificación. No se alteró configuración ni se inició un deploy.
