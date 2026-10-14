"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("V1000: escritura CAS de saldo obliga empresa y sede incluso por _id",()=>{
 assert.match(code,/Saldo\.updateOne\(\{_id:head\._id,empresaId,sedeId,secuencia:head\.secuencia,hashUltimo:head\.hashUltimo\}/);
 assert.match(code,/tenant\.parse\(\{empresaId,sedeId\}\)/);
});
