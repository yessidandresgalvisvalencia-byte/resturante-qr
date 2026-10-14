"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../services/pagosPedidos.service.js"),"utf8");
test("Wompi COP rechaza moneda alterada antes y dentro de transacción",()=>{
 assert.match(src,/transaction\.currency === "COP" && intento\.currency === "COP"/);
 assert.match(src,/lockedIntento\.currency !== "COP" \|\| transaction\.currency !== "COP"/);
 assert.doesNotMatch(src,/String\(transaction\.currency \|\| ""\)\.toUpperCase\(\)/);
});
