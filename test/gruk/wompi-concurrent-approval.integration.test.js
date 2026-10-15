"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const uri = process.env.TEST_MONGO_URI;

test("concurrent Wompi approvals create exactly one paid sale", { skip: !uri }, async () => {
  const mongoose = require("mongoose");
  const IntentoPagoPedido = require("../../models/IntentoPagoPedido");
  const Pedido = require("../../models/pedido");
  const Restaurante = require("../../models/restaurante");
  const ProductoServicio = require("../../models/ProductoServicio");
  const Venta = require("../../models/Venta");
  const { confirmarPagoPedidoWompi } = require("../../services/pagosPedidos.service");
  await mongoose.connect(uri, { dbName: "gruk_ci_wompi_approval" });
  try {
    await Promise.all([
      IntentoPagoPedido.init(), Pedido.init(), Restaurante.init(),
      ProductoServicio.init(), Venta.init()
    ]);
    const empresaId = new mongoose.Types.ObjectId();
    const restaurantId = "ci-approval-" + empresaId.toString();
    const producto = await ProductoServicio.create({
      empresaId, tipo: "producto", nombre: "Producto CI",
      precioVenta: 1234, costoUnitario: 500
    });
    await Restaurante.create({
      empresaId, restaurantId, nombreRestaurante: "Restaurante CI",
      correo: "wompi-ci@example.test", usuarioAdmin: "ci-" + empresaId.toString(),
      passwordAdmin: "not-a-real-password"
    });
    const pedido = await Pedido.create({
      restaurantId, productoServicioId: producto._id, cantidad: 1,
      precioUnitario: 1234, precio: 1234, producto: "Producto CI", mesa: 1
    });
    const reference = "GRUK_PEDIDO_" + new mongoose.Types.ObjectId().toString();
    await IntentoPagoPedido.create({
      reference, restaurantId, pedidoIds: [pedido._id],
      amountInCents: 123400, currency: "COP", estado: "CREADO"
    });
    const transaction = {
      reference, status: "APPROVED", id: "ci-" + reference,
      amount_in_cents: 123400, currency: "COP"
    };
    const results = await Promise.allSettled([
      confirmarPagoPedidoWompi({ transaction }),
      confirmarPagoPedidoWompi({ transaction })
    ]);
    // A write conflict can cause a retryable error to reach the caller; it
    // must never cause a second persisted sale.
    assert.ok(results.some(x => x.status === "fulfilled" && x.value.ok));
    assert.equal(await Venta.countDocuments({
      empresaId, origen: "restaurante", origenId: pedido._id
    }), 1);
    assert.equal((await Pedido.findById(pedido._id)).estadoPago, "pagado");
    assert.equal((await IntentoPagoPedido.findOne({ reference })).estado, "APROBADO");
    const replay = await confirmarPagoPedidoWompi({ transaction });
    assert.equal(replay.ok, true);
    assert.equal(replay.idempotent, true);
    assert.equal(await Venta.countDocuments({
      empresaId, origen: "restaurante", origenId: pedido._id
    }), 1);
  } finally {
    await mongoose.disconnect();
  }
});
