"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const code = fs.readFileSync(path.join(__dirname, "../../routes/pagos.js"), "utf8");
test("Crear pago rechaza IDs inválidos antes de generar intento Wompi", () => {
  const validate = code.indexOf("validarPedidosIntento(pedidos.map(p => p._id))");
  const catchError = code.indexOf('error.message === "PEDIDOS_DEL_INTENTO_INVALIDOS"');
  const response = code.indexOf('return res.status(409).json({ ok: false, error: "Los pedidos requieren revisión antes de pagar" })');
  const create = code.indexOf("await IntentoPagoPedido.create(");
  assert.ok(validate >= 0 && catchError > validate && response > catchError && create > response);
});
