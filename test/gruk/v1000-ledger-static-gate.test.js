"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("V1000: importes se transforman con Decimal y Dinero, no float",()=>{
 const s=read("core/finance/v1000/money.js");
 assert.match(s,/require\("dinero\.js"\)/);
 assert.match(s,/require\("decimal\.js"\)/);
 assert.match(s,/BigInt/);
});
test("V1000: ledger registra movimiento y saldo en la misma transaccion",()=>{
 const s=read("services/ledgerV1000.service.js");
 assert.match(s,/session\.withTransaction/);
 assert.match(s,/Movimiento\.create\(\[doc\],\{session\}\)/);
 assert.match(s,/Saldo\.updateOne/);
 assert.match(s,/hashAnterior:head\.hashUltimo/);
});
test("V1000: no se permiten mutaciones en el historial",()=>{
 const s=read("models/MovimientoLedgerV1000.js");
 for(const op of ["updateOne","updateMany","deleteOne","deleteMany","replaceOne"])
  assert.ok(s.includes('"'+op+'"'));
 assert.match(s,/LEDGER_APPEND_ONLY/);
});
test("V1000: contratos exigen empresa y sede ULID",()=>{
 const s=read("core/finance/v1000/validation.js");
 assert.match(s,/require\("zod"\)/);
 assert.match(s,/empresaId:ulid,sedeId:ulid/);
 assert.match(s,/hashAnterior/);
});
