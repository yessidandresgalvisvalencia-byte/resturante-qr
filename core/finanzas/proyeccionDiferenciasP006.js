"use strict";

// P0-06 read-only projection for a future authorized differences panel.
// Never mutates ledger, stock, or persisted reconciliation evidence.
function own(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("P006_PANEL_INVALIDO");
  const d = Object.getOwnPropertyDescriptor(value, key);
  if (!d || !Object.prototype.hasOwnProperty.call(d, "value")) throw new Error("P006_PANEL_CAMPO_INVALIDO_" + key);
  return d.value;
}
function projectReconciliationDifferences(result) {
  const empresaId = own(result, "empresaId");
  const sedeId = own(result, "sedeId");
  const financial = own(result, "financial");
  const stock = own(result, "stock");
  if (own(financial, "empresaId") !== empresaId || own(financial, "sedeId") !== sedeId ||
      own(stock, "empresaId") !== empresaId || own(stock, "sedeId") !== sedeId) {
    throw new Error("P006_PANEL_SCOPE_MISMATCH");
  }
  const differenceCentavos = own(financial, "differenceCentavos");
  if (typeof differenceCentavos !== "string" || !/^-?(0|[1-9]\\d*)$/.test(differenceCentavos) || differenceCentavos === "-0") {
    throw new Error("P006_PANEL_MONTO_INVALIDO");
  }
  const differences = own(stock, "diferencias");
  if (!Array.isArray(differences) || differences.length > 10000) throw new Error("P006_PANEL_STOCK_INVALIDO");
  const items = [];
  for (let i = 0; i < differences.length; i++) {
    const d = Object.getOwnPropertyDescriptor(differences, String(i));
    if (!d || !Object.prototype.hasOwnProperty.call(d, "value")) throw new Error("P006_PANEL_INDICE_INVALIDO");
    const item = d.value;
    const productoId = own(item, "productoId");
    const unidad = own(item, "unidad");
    const diferencia = own(item, "diferencia");
    if (typeof productoId !== "string" || !productoId || typeof unidad !== "string" || !unidad ||
        typeof diferencia !== "string" || !/^-?(0|[1-9]\\d*)(\\.\\d+)?$/.test(diferencia) || diferencia.startsWith("-0") && Number(diferencia) === 0) {
      throw new Error("P006_PANEL_STOCK_DATO_INVALIDO");
    }
    items.push(Object.freeze({ productoId, unidad, diferencia }));
  }
  return Object.freeze({
    empresaId, sedeId, differenceCentavos,
    cashMismatch: differenceCentavos !== "0",
    stockDifferences: Object.freeze(items),
    readOnly: true
  });
}
module.exports = { projectReconciliationDifferences };
