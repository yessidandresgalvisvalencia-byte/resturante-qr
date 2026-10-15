"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("sale service refuses suppressed event delivery without a transaction", async () => {
  const { registrarVentaDesdePedido } = require("../../services/ventas.service");
  const empresaId = "507f1f77bcf86cd799439011";
  await assert.rejects(
    registrarVentaDesdePedido({
      pedido: { _id: "507f1f77bcf86cd799439012", productoServicioId: "507f1f77bcf86cd799439013" },
      empresaId,
      emitirEvento: false,
      session: null
    }),
    /GRUK_VENTA_SIN_SESION_TRANSACCIONAL/
  );
});
