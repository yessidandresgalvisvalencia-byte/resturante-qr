"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("Ledger V1000 fuerza validadores en actualización ACID de cabecera",()=>{
 assert.match(code,/\$inc:\{secuencia:1\}\},\{session,runValidators:true\}\)/);
 assert.match(code,/updated\.modifiedCount!==1/);
 assert.match(code,/await Movimiento\.create\(\[doc\],\{session\}\)/);
});
