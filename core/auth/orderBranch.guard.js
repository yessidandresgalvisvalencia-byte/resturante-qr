"use strict";

const mongoose = require("mongoose");
const Sede = require("../../models/sede");

// This guard is for authenticated order mutations only, not public QR reads.
// A legacy order without tenant/site identifiers cannot independently prove
// authorization: its owning Restaurante must first be scoped by empresaId.
function denied(reason) {
  const error = new Error(reason);
  error.statusCode = 403;
  return error;
}

function siteLookup(empresaId, restaurantId, reference) {
  const value = String(reference);
  return {
    empresaId,
    restauranteId: restaurantId,
    $or: [
      { codigoSede: value },
      { _id: mongoose.Types.ObjectId.isValid(value) ? value : null }
    ]
  };
}

async function authorizeOrderBranch({ pedido, restaurante, auth, session = null, siteModel = Sede }) {
  if (!pedido || !restaurante || !auth?.empresaId || !pedido.restaurantId) {
    throw denied("PEDIDO_FUERA_SEDE");
  }
  if (String(restaurante.empresaId) !== String(auth.empresaId) ||
      String(pedido.restaurantId) !== String(restaurante.restaurantId)) {
    throw denied("PEDIDO_FUERA_TENANT");
  }
  if (pedido.empresaId != null && String(pedido.empresaId) !== String(auth.empresaId)) {
    throw denied("PEDIDO_FUERA_TENANT");
  }
  const branchRef = auth.sedeId == null ? "" : String(auth.sedeId).trim();
  const orderRef = pedido.sedeId == null ? "" : String(pedido.sedeId).trim();

  // Staff cannot fall back to company-wide/legacy orders when branch is absent.
  if (!branchRef && auth.rol !== "DUEÑO") {
    throw denied("SEDE_AUTORIZADA_REQUERIDA");
  }
  if (branchRef && !orderRef) {
    throw denied("PEDIDO_SIN_SEDE");
  }
  if (!orderRef) return { sedeObjectId: null, pedidoParaVenta: pedido };

  const ref = branchRef || orderRef;
  const query = siteModel.findOne(siteLookup(restaurante.empresaId, pedido.restaurantId, ref));
  const sede = await (session ? query.session(session) : query).lean();
  if (!sede) throw denied("SEDE_FUERA_TENANT");

  if (orderRef !== String(sede._id) && orderRef !== String(sede.codigoSede)) {
    throw denied("PEDIDO_FUERA_SEDE");
  }

  // Sales need the canonical ObjectId, while legacy pedidos may store a code.
  return {
    sedeObjectId: sede._id,
    pedidoParaVenta: { ...(typeof pedido.toObject === "function" ? pedido.toObject() : pedido), sedeId: sede._id }
  };
}

module.exports = { authorizeOrderBranch };
