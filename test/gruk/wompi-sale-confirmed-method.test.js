"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
test("Wompi confirma metodo tarjeta dentro de la venta antes de registrar Outbox", () => {
  const sale = source.indexOf("await registrarVentaDesdePedido({");
  const paidMethod = source.indexOf('metodoPagoConfirmado: "tarjeta"', sale);
  const outbox = source.indexOf("await registrarVentaEnOutbox({", sale);
  assert.ok(sale >= 0 && paidMethod > sale && paidMethod < outbox);
});
