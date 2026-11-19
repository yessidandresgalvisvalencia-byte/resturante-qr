"use strict";

const mongoose = require("mongoose");
const Inventario = require("../models/Inventario");
const MovimientoInventario = require("../models/MovimientoInventario");

function stockError(code, statusCode = 409) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// Only used for a catalog product explicitly marked manejaInventario=true.
// Payment and stock movement must be in the SAME MongoDB transaction.
async function descontarInventarioPorVenta({
  venta, pedido, empresaId, sedeId, session,
  inventarioModel = Inventario,
  movimientoModel = MovimientoInventario
}) {
  if (!session || !venta?._id || !pedido?._id ||
      !mongoose.Types.ObjectId.isValid(empresaId) ||
      !mongoose.Types.ObjectId.isValid(sedeId) ||
      !mongoose.Types.ObjectId.isValid(venta.productoServicioId)) {
    throw stockError("INVENTARIO_TRANSACCION_REQUERIDA", 500);
  }
  const cantidad = Number(venta.cantidad);
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) {
    throw stockError("INVENTARIO_CANTIDAD_INVALIDA", 422);
  }

  // A sale cannot arbitrarily choose one of several balances for the same
  // product and branch. Reject ambiguity rather than decrementing a random row.
  const rows = await inventarioModel.find({
    empresaId,
    sedeId,
    productoServicioId: venta.productoServicioId,
    anulado: false
  }).select("_id cantidad costo").limit(2).session(session).lean();
  if (rows.length !== 1) throw stockError("INVENTARIO_NO_UNICO_O_INEXISTENTE");

  const row = rows[0];
  if (!Number.isSafeInteger(row.cantidad) || row.cantidad < cantidad) {
    throw stockError("INVENTARIO_STOCK_INSUFICIENTE");
  }

  // Atomic compare-and-swap prevents lost updates if multiple tablets pay
  // concurrently. A transaction abort restores both the sale and the stock.
  const previous = await inventarioModel.findOneAndUpdate({
    _id: row._id,
    empresaId,
    sedeId,
    productoServicioId: venta.productoServicioId,
    anulado: false,
    cantidad: { $gte: cantidad }
  }, { $inc: { cantidad: -cantidad } }, {
    new: false, session, runValidators: true
  });
  if (!previous) throw stockError("INVENTARIO_STOCK_INSUFICIENTE");

  const before = Number(previous.cantidad);
  const after = before - cantidad;
  if (!Number.isSafeInteger(before) || after < 0) {
    throw stockError("INVENTARIO_SALDO_INVALIDO");
  }

  await movimientoModel.create([{
    empresaId,
    sedeId,
    productoServicioId: venta.productoServicioId,
    inventarioId: row._id,
    tipo: "salida",
    motivo: "venta",
    cantidad,
    stockAnterior: before,
    stockNuevo: after,
    costoUnitario: venta.costoUnitario,
    referenciaTipo: "VENTA",
    referenciaId: venta._id,
    metadata: { pedidoId: String(pedido._id) }
  }], { session });

  return { inventarioId: row._id, stockAnterior: before, stockNuevo: after };
}

module.exports = { descontarInventarioPorVenta };
