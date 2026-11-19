'use strict';

// Read-only GRUK Empresarial summary. Existing Mongo Number fields are legacy;
// this computes exactly from their canonical decimal representations, but cannot
// recover precision already lost before persistence.
const { parseMoneyToCents, formatCents } = require('./enterpriseMoney');
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function persistedCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError('Invalid persisted monetary amount');
  }
  // Reject exponential notation and sub-cent precision rather than silently round.
  return parseMoneyToCents(String(value));
}
function sum(records, field) {
  if (!Array.isArray(records)) throw new TypeError('Records must be an array');
  let total = 0n;
  // Reject sparse collections, inherited fields and executable accessors. Financial
  // inputs are expected to be lean persisted records, never computed properties.
  for (let i = 0; i < records.length; i++) {
    const slot = Object.getOwnPropertyDescriptor(records, String(i));
    if (!slot || !Object.hasOwn(slot, 'value')) {
      throw new TypeError('Invalid financial record slot');
    }
    const record = slot.value;
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError('Invalid financial record');
    }
    const amount = Object.getOwnPropertyDescriptor(record, field);
    if (!amount || !Object.hasOwn(amount, 'value')) {
      throw new TypeError('Invalid financial amount field');
    }
    total += persistedCents(amount.value);
    if (total > MAX) throw new RangeError('Financial total exceeds safe cents');
  }
  return total;
}
function exactFinancialSummary(ventas, gastos) {
  const ingresos = sum(ventas, 'total');
  const egresos = sum(gastos, 'monto');
  const neto = ingresos - egresos;
  return Object.freeze({
    ingresos: formatCents(ingresos),
    gastos: formatCents(egresos),
    resultado: (neto < 0n ? '-' : '') + formatCents(neto < 0n ? -neto : neto),
    unidad: 'COP',
    origen: 'legacy-number',
    advertencia: 'Los valores provienen de campos Number existentes; la precision previa al almacenamiento no puede recuperarse.'
  });
}
module.exports = { persistedCents, exactFinancialSummary };
