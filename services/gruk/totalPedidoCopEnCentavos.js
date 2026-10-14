"use strict";

const MAX_PESOS = Math.floor(Number.MAX_SAFE_INTEGER / 100);

function totalPedidoCopEnCentavos(precios) {
  if (!Array.isArray(precios) || precios.length === 0) {
    throw new Error("PEDIDOS_SIN_PRECIOS");
  }
  let pesos = 0;
  for (const precio of precios) {
    if (typeof precio !== "number" || !Number.isSafeInteger(precio) ||
        precio <= 0 || precio > MAX_PESOS) {
      throw new Error("MONTO_PEDIDO_NO_REPRESENTABLE");
    }
    pesos += precio;
    if (!Number.isSafeInteger(pesos) || pesos > MAX_PESOS) {
      throw new Error("MONTO_TOTAL_NO_REPRESENTABLE");
    }
  }
  return pesos * 100;
}

module.exports = { totalPedidoCopEnCentavos };
