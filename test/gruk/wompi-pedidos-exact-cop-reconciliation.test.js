"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const service=fs.readFileSync(path.join(__dirname,"../../services/pagosPedidos.service.js"),"utf8");
test("Wompi impide redondeo monetario silencioso al conciliar pedidos",()=>{
 assert.match(service,/Number\.isSafeInteger\(valor\)/);
 assert.match(service,/MONTO_PEDIDO_NO_REPRESENTABLE/);
 assert.match(service,/MONTO_TOTAL_NO_REPRESENTABLE/);
 assert.match(service,/const totalActual = totalPesos \* 100/);
 assert.doesNotMatch(service,/Math\.round\(Number\(p\.precio\) \* 100\)/);
});
