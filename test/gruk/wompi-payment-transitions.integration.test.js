"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const uri = process.env.TEST_MONGO_URI;

test("Wompi webhook transitions preserve terminal approval and rejection under concurrency", { skip: !uri }, async () => {
  const mongoose = require("mongoose");
  const IntentoPagoPedido = require("../../models/IntentoPagoPedido");
  const { confirmarPagoPedidoWompi } = require("../../services/pagosPedidos.service");
  // Isolated database; Node's test runner executes test files in separate workers.
  await mongoose.connect(uri, { dbName: "gruk_ci_wompi_transitions" });
  try {
    await mongoose.connection.db.dropDatabase();
    await IntentoPagoPedido.init();

    const makeAttempt = async (reference, estado = "CREADO", transactionId = "") =>
      IntentoPagoPedido.create({
        reference, restaurantId: "ci_wompi",
        pedidoIds: [new mongoose.Types.ObjectId()],
        amountInCents: 123400, currency: "COP", estado, transactionId
      });
    const webhook = (reference, status, id = "wompi-ci-1") => ({
      reference, status, id, amount_in_cents: 123400, currency: "COP"
    });

    await makeAttempt("GRUK_PEDIDO_CI_APPROVED", "APROBADO", "wompi-ci-1");
    const [latePending, lateDeclined] = await Promise.all([
      confirmarPagoPedidoWompi({ transaction: webhook("GRUK_PEDIDO_CI_APPROVED", "PENDING") }),
      confirmarPagoPedidoWompi({ transaction: webhook("GRUK_PEDIDO_CI_APPROVED", "DECLINED") })
    ]);
    assert.equal(latePending.estado, "APROBADO");
    assert.equal(lateDeclined.estado, "APROBADO");
    assert.equal((await IntentoPagoPedido.findOne({ reference: "GRUK_PEDIDO_CI_APPROVED" })).estado, "APROBADO");

    await makeAttempt("GRUK_PEDIDO_CI_REJECTED");
    await confirmarPagoPedidoWompi({ transaction: webhook("GRUK_PEDIDO_CI_REJECTED", "DECLINED") });
    const late = await confirmarPagoPedidoWompi({ transaction: webhook("GRUK_PEDIDO_CI_REJECTED", "PENDING") });
    assert.equal(late.estado, "RECHAZADO");
    assert.equal((await IntentoPagoPedido.findOne({ reference: "GRUK_PEDIDO_CI_REJECTED" })).estado, "RECHAZADO");

    const mismatched = await confirmarPagoPedidoWompi({
      transaction: webhook("GRUK_PEDIDO_CI_APPROVED", "APPROVED", "wompi-ci-different")
    });
    assert.equal(mismatched.ok, false);
    assert.equal(mismatched.reason, "TRANSACCION_DIFERENTE_PARA_REFERENCIA");

    const invalidAmount = await confirmarPagoPedidoWompi({
      transaction: { ...webhook("GRUK_PEDIDO_CI_APPROVED", "APPROVED"), amount_in_cents: "123400" }
    });
    assert.equal(invalidAmount.reason, "INTEGRIDAD_ECONOMICA_INVALIDA");
  } finally {
    await mongoose.disconnect();
  }
});
