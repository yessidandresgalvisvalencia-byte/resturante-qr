"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../../routes/pagos.js"), "utf8");

test("Wompi: la creación de intención valida pedidos antes de calcular el importe", () => {
  const guard = source.indexOf("validarPedidosIntento(pedidos.map(p => p._id))");
  const calculation = source.indexOf("const amountInCents = pedidos.reduce(");
  const write = source.indexOf("await IntentoPagoPedido.create(");
  assert.ok(guard > 0, "falta validador de pedidos al crear pago");
  assert.ok(guard < calculation && calculation < write,
    "la validación debe preceder al cálculo y a la escritura");
});

test("Wompi: la creación y confirmación reutilizan el mismo guard de pedidos", () => {
  const confirm = fs.readFileSync(path.join(__dirname, "../../services/pagosPedidos.service.js"), "utf8");
  assert.match(source, /require\("\.\.\/services\/gruk\/validarPedidosIntento"\)/);
  assert.match(confirm, /require\("\.\/gruk\/validarPedidosIntento"\)/);
  assert.match(confirm, /validarPedidosIntento\(lockedIntento\.pedidoIds\)/);
});
