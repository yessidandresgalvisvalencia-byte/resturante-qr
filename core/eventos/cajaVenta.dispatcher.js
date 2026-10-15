"use strict";

/**
 * Fail closed until the shared sale outbox tracks delivery acknowledgements
 * independently for every required consumer. A Caja-only ACK must never mark
 * a shared VENTA_COMPLETADA event as globally ENTREGADO.
 */
async function despacharSiguienteVentaACaja() {
  throw new Error("CAJA_OUTBOX_REQUIERE_ACK_POR_CONSUMIDOR");
}

module.exports = { despacharSiguienteVentaACaja };
