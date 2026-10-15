"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const service=fs.readFileSync(path.join(__dirname,"../../services/pagosPedidos.service.js"),"utf8");
const calculator=fs.readFileSync(path.join(__dirname,"../../services/gruk/totalPedidoCopEnCentavos.js"),"utf8");
test("Wompi impide redondeo monetario silencioso al conciliar pedidos",()=>{
 assert.match(calculator,/Number\.isSafeInteger\(precio\)/);
 assert.match(calculator,/MONTO_PEDIDO_NO_REPRESENTABLE/);
 assert.match(calculator,/MONTO_TOTAL_NO_REPRESENTABLE/);
 assert.match(service,/const totalActual = totalPedidoCopEnCentavos/);
 assert.doesNotMatch(service,/Math\.round\(Number\(p\.precio\) \* 100\)/);
});
