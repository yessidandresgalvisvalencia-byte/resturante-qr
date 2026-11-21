"use strict";

// P0-06: read-only physical-vs-book stock comparison. No database writes.
// Quantities are signed integer strings in the SAME pre-normalized stock unit.
const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function id(value, field) {
  if (typeof value !== "string" || !ID.test(value)) throw new Error("STOCK_ID_INVALIDO_" + field);
  return value;
}
function quantity(value) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,15})$/.test(value)) throw new Error("STOCK_CANTIDAD_INVALIDA");
  const n = BigInt(value);
  if (n > MAX) throw new Error("STOCK_CANTIDAD_RANGO");
  return n;
}
function own(obj, field) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("STOCK_ENTRADA_INVALIDA");
  const descriptor = Object.getOwnPropertyDescriptor(obj, field);
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) throw new Error("STOCK_CAMPO_INVALIDO_" + field);
  return descriptor.value;
}
function reconcileStock(input) {
  const empresaId = id(own(input, "empresaId"), "empresa");
  const sedeId = id(own(input, "sedeId"), "sede");
  const records = own(input, "records");
  if (!Array.isArray(records) || records.length > 10000) throw new Error("STOCK_REGISTROS_INVALIDOS");
  const seen = new Set();
  const differences = [];
  for (const record of records) {
    if (own(record, "empresaId") !== empresaId || own(record, "sedeId") !== sedeId) throw new Error("STOCK_TENANT_INCORRECTO");
    const productoId = id(own(record, "productoId"), "producto");
    const unidad = id(own(record, "unidad"), "unidad");
    const key = JSON.stringify([productoId, unidad]);
    if (seen.has(key)) throw new Error("STOCK_REGISTRO_DUPLICADO");
    seen.add(key);
    const book = quantity(own(record, "registrado"));
    const physical = quantity(own(record, "fisico"));
    const difference = physical - book;
    if (difference !== 0n) differences.push(Object.freeze({
      productoId, unidad, registrado: book.toString(), fisico: physical.toString(),
      diferencia: difference.toString()
    }));
  }
  // Code-point ordering is deterministic across locales and Node/ICU versions.
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;\n  differences.sort((a, b) => compare(a.productoId, b.productoId) || compare(a.unidad, b.unidad));
  return Object.freeze({ empresaId, sedeId, totalRegistros: seen.size,
    diferencias: Object.freeze(differences), balanced: differences.length === 0 });
}
module.exports = { reconcileStock };
