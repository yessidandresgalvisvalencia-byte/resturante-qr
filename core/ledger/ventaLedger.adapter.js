"use strict";
// Pure, fail-closed adapter. Does NOT post, mutate, or replay historical sales.
// Amounts must be canonical COP strings; never pass legacy Number values here.
const { parseCentavos } = require("./copAmounts");
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const DECIMAL = /^(0|[1-9][0-9]*)(?:\\.([0-9]{1,2}))?$/;
function copToCentavos(value) {
  if (typeof value !== "string" || value.length > 34) throw new TypeError("VENTA_COP_STRING_REQUIRED");
  const match = DECIMAL.exec(value);
  if (!match) throw new TypeError("VENTA_COP_INVALID");
  const centavos = (BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"))).toString();
  parseCentavos(centavos);
  return centavos;
}
function buildVentaLedgerCommand({ventaId, empresaId, sedeId, actorId, amountCOP, ip}) {
  for (const [name, value] of Object.entries({ventaId, empresaId, sedeId, actorId})) {
    if (typeof value !== "string" || !OBJECT_ID.test(value)) throw new TypeError("VENTA_LEDGER_INVALID_" + name);
  }
  if (typeof ip !== "string" || ip.length === 0 || ip.length > 100) throw new TypeError("VENTA_LEDGER_INVALID_IP");
  return Object.freeze({
    empresaId: empresaId.toLowerCase(),
    sedeId: sedeId.toLowerCase(),
    cuentaId: "VENTAS",
    eventId: "venta_" + ventaId.toLowerCase(),
    tipo: "CREDITO",
    amountCentavos: copToCentavos(amountCOP),
    actorId: actorId.toLowerCase(),
    ip
  });
}
module.exports = { copToCentavos, buildVentaLedgerCommand };
