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

function reconcileMovements({ empresaId, sedeId, movements, expectedCentavos }) {
  requireId(empresaId, "empresa");
  requireId(sedeId, "sede");
  if (!Array.isArray(movements) || movements.length > 10000) throw new Error("CONCILIACION_MOVIMIENTOS_INVALIDOS");
  const expected = parseCentavos(expectedCentavos);
  let actual = 0n;
  const seen = new Map();
  const duplicates = [];
  for (const movement of movements) {
    if (!movement || typeof movement !== "object" || Array.isArray(movement)) throw new Error("CONCILIACION_MOVIMIENTO_INVALIDO");
    if (movement.empresaId !== empresaId || movement.sedeId !== sedeId) throw new Error("CONCILIACION_TENANT_INCORRECTO");
    const id = requireId(movement.idempotencyKey, "idempotencia");
    const amount = parseCentavos(movement.centavos);
    if (seen.has(id)) {
      if (seen.get(id) !== amount) throw new Error("CONCILIACION_IDEMPOTENCIA_CONFLICTO");
      duplicates.push(id);
      continue;
    }
    seen.set(id, amount);
    actual += amount;
  }
  const difference = expected - actual;
  return Object.freeze({
    empresaId, sedeId, expectedCentavos: expected.toString(),
    actualCentavos: actual.toString(), differenceCentavos: difference.toString(),
    balanced: difference === 0n, uniqueMovements: seen.size,
    duplicateKeys: Object.freeze(duplicates)
  });
}

module.exports = { reconcileMovements };
