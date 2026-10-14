"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("V1000 no permite contabilizar contra una cabecera con saldo o secuencia corruptos",()=>{
 assert.match(src,/Number\.isSafeInteger\(head\.saldoCentavos\)/);
 assert.match(src,/Number\.isSafeInteger\(head\.secuencia\)/);
 assert.match(src,/LEDGER_CABECERA_INVALIDA/);
 assert.match(src,/LEDGER_GENESIS_INCONSISTENTE/);
});
test("V1000 coteja último asiento con cabecera y recalcula hash antes de contabilizar",()=>{
 const check=src.indexOf("LEDGER_CADENA_INCONSISTENTE");
 const update=src.indexOf("const updated=await Saldo.updateOne");
 assert.ok(check>0&&update>check);
 assert.match(src,/Movimiento\.findOne\(\{empresaId,sedeId,secuencia:head\.secuencia\}\)/);
 assert.match(src,/hashMovimiento\(\{\.\.\.last,timestamp:new Date\(last\.timestamp\)\.toISOString\(\)\}\)!==last\.hash/);
});
