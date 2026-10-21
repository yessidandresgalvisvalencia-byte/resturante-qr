# GRUK Finanzas Personales — liberación segura de gastos hormiga V81

**Alcance:** únicamente la rama `feature/finanzas-personales` y el servicio Render `srv-dav8md7pn0mc739khig0`. **No modificar `main` ni GRUK Empresarial.**

## Estado de partida

- Último deploy confirmado `live`: `fb83d3ead474bd28c9de63d151556e4863da6f69`.
- La fusión #378 (`f44a0535ad86ac7f10a90be6a700cfc8618a43e0`) no llegó a producción: Render devolvió `build_failed` por límite de minutos.
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

La cifra anterior es solo un **indicador de compatibilidad, no equivale a gastos hormiga afectados**: incluye gastos de otras categorías y no mide el porcentaje exacto de usuarios bloqueados. Si el conteo es mayor que cero, analizar por qué falta la marca mediante conciliación autorizada, sin inferir salidas ni actualizar registros automáticamente. Evaluar migración de metadatos auditada y reversible en entorno de prueba; por diseño la aplicación debe **fallar cerrada** ante datos inciertos.

## Puerta 3 — pruebas de integración

1. Combinar los cambios del clasificador y el resumen **una sola vez** sobre la rama personal, sin modificar `main`.
2. Confirmar GitHub Actions: seguridad, precisión e integridad V81 y GRUK Gate todos `success` para **el commit exacto a desplegar**.
3. En una cuenta de ensayo, registrar solo movimientos ficticios: Rappi de caja, Rappi con crédito, café, cafetera, arriendo, pago de tarjeta, una anulación y una repetición por idempotencia. Comprobar que consumo = caja + crédito, promedio diario reconciliado, cuentas separadas, visibilidad por usuario, ventana Bogotá y banner cuando falla la consulta.
4. Comprobar que el HTML referencia el JS vigente `hormiga-caja-credito-integridad-v81`; recargar en sesión antigua y nueva.
5. Ejecutar verificación de índices/plan de consulta (`explain`) con usuario de pruebas. El índice en el esquema no demuestra que ya exista en producción.

## Puerta 3B — bloqueo explícito de certificación append-only

**Hallazgo #407 (crítico):** `flujoCajaPersonal.service.js` todavía modifica `anterior` con `Object.assign(...)` y `.save()` durante correcciones, y modifica `tx.estado` y `.save()` durante anulaciones. El Outbox aporta evidencia adicional, pero **no vuelve inmutable el asiento original**. No describir este ledger como "solo INSERT" ni prometer trazabilidad criptográfica integral.

Comprobar el estado exacto con el verificador de patrones:

```bash
node scripts/gruk-personal-ledger-mutability-audit.js
node scripts/gruk-personal-ledger-mutability-audit.js --enforce
```

El segundo comando debe **salir con código distinto de cero** mientras persistan estos patrones, y es una **puerta manual obligatoria para certificar GRUK V1000 como ledger append-only**. No es parte de los jobs regulares de CI ni debe confundirse con un test de invariantes completo: detectar la ausencia de patrones no demuestra inmutabilidad por sí sola. Corregir la arquitectura y agregar pruebas de eventos compensatorios antes de retirar esta reserva.

## Puerta 4 — Render y verificación posterior

- Requerir estado de deploy **`live`**, SHA exacto y verificaciones HTTP de salud y comportamiento con cuenta de ensayo. Un deploy `build_failed` o `deploying` no es éxito.
- No migrar ni cambiar saldos reales para facilitar el despliegue.
- Si falla, detener nuevas fusiones, conservar evidencia, volver al último deploy `live` si el proveedor permite una restauración segura, y comparar datos sin editarlos.
- Registrar fecha, SHA, estado de pruebas, estado Render y responsable antes de anunciar al usuario que puede probar.
