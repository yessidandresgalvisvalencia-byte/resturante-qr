"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const route = fs.readFileSync(path.join(__dirname,"../../routes/pagos.js"),"utf8");
test("Wompi: importe inválido devuelve 409 antes de crear intento",()=>{
 const calculator=route.indexOf("totalPedidoCopEnCentavos(pedidos.map(p => p.precio))");
 const reject=route.indexOf("return res.status(409).json({ ok: false, error: \"Los importes del pedido requieren revisión antes de pagar\" })");
 const insert=route.indexOf("await IntentoPagoPedido.create(");
 assert.ok(calculator>0&&reject>calculator&&insert>reject);
 assert.match(route,/MONTO_PEDIDO_NO_REPRESENTABLE/);
 assert.match(route,/MONTO_TOTAL_NO_REPRESENTABLE/);
});
