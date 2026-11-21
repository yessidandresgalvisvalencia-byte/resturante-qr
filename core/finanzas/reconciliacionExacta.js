"use strict";

// P0-06: pure, read-only reconciliation of already scoped journal movements.
// All amounts are signed decimal centavo strings, never JSON numbers.
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;

function requireId(value, label) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error("CONCILIACION_ID_INVALIDO_" + label);
  return value;
}

function parseCentavos(value) {
  if (typeof value !== "string" || !/^-?(0|[1-9]\d{0,15})$/.test(value)) {
    throw new Error("CONCILIACION_MONTO_INVALIDO");
  }
  if (value === "-0") throw new Error("CONCILIACION_MONTO_INVALIDO");
  const amount = BigInt(value);
  if (amount > MAX || amount < -MAX) throw new Error("CONCILIACION_MONTO_RANGO");
  return amount;
}

function reconcileMovements(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("CONCILIACION_ENTRADA_INVALIDA");
  const values = {};
  for (const field of ["empresaId", "sedeId", "movements", "expectedCentavos"]) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      throw new Error("CONCILIACION_ENTRADA_CAMPO_INVALIDO_" + field);
    }
    values[field] = descriptor.value;
  }
  const { empresaId, sedeId, movements, expectedCentavos } = values;
  requireId(empresaId, "empresa");
  requireId(sedeId, "sede");
  if (!Array.isArray(movements) || movements.length > 10000) throw new Error("CONCILIACION_MOVIMIENTOS_INVALIDOS");
  const expected = parseCentavos(expectedCentavos);
  let actual = 0n;
  const seen = new Map();
  const duplicates = [];
  for (const movement of movements) {
    if (!movement || typeof movement !== "object" || Array.isArray(movement)) throw new Error("CONCILIACION_MOVIMIENTO_INVALIDO");
    // Reject inherited scope/identity fields: untrusted payloads must carry their own tenant context.
    for (const field of ["empresaId", "sedeId", "idempotencyKey", "centavos"]) {
      const descriptor = Object.getOwnPropertyDescriptor(movement, field);
      if (!descriptor) throw new Error("CONCILIACION_CAMPO_PROPIO_FALTANTE_" + field);
      if (!Object.prototype.hasOwnProperty.call(descriptor, "value")) throw new Error("CONCILIACION_CAMPO_ACCESOR_NO_PERMITIDO_" + field);
    }
    if (movement.empresaId !== empresaId || movement.sedeId !== sedeId) throw new Error("CONCILIACION_TENANT_INCORRECTO");
    const id = requireId(movement.idempotencyKey, "idempotencia");
    const amount = parseCentavos(movement.centavos);
    if (seen.has(id)) {
      if (seen.get(id) !== amount) throw new Error("CONCILIACION_IDEMPOTENCIA_CONFLICTO");
      duplicates.push(id);
      continue;
    }
    // Never allow a sequence of individually valid movements to exceed the
    // supported centavo ledger boundary (no implicit unsafe JSON conversion).
    const nextActual = actual + amount;
    if (nextActual > MAX || nextActual < -MAX) throw new Error("CONCILIACION_TOTAL_RANGO");
    seen.set(id, amount);
    actual = nextActual;
  }
  const difference = expected - actual;
  // A valid expected and actual balance can still produce an out-of-range
  // signed discrepancy. Keep every exposed centavo field within the contract.
  if (difference > MAX || difference < -MAX) throw new Error("CONCILIACION_DIFERENCIA_RANGO");
  return Object.freeze({
    empresaId, sedeId, expectedCentavos: expected.toString(),
    actualCentavos: actual.toString(), differenceCentavos: difference.toString(),
    balanced: difference === 0n, uniqueMovements: seen.size,
    duplicateKeys: Object.freeze(duplicates)
  });
}

module.exports = { reconcileMovements };
