"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("Ledger V1000 recupera un asiento confirmado por operacionId antes de abrir sesión",()=>{
 const lookup=source.indexOf("const previo=await recuperar()");
 const session=source.indexOf("const session=await mongoose.startSession()");
 assert.ok(lookup>=0&&session>lookup);
 assert.match(source,/if\(previo\)return previo/);
});
test("Ledger V1000 no admite replay con monto, tipo o actor diferentes",()=>{
 assert.match(source,/existing\.montoCentavos===montoCentavos/);
 assert.match(source,/existing\.tipo===tipo/);
 assert.match(source,/existing\.actorId===actorId/);
 assert.match(source,/LEDGER_OPERACION_REUTILIZADA_INCONSISTENTE/);
});
test("Ledger V1000 verifica operación repetida en snapshot y reconcilia confirmación incierta",()=>{
 assert.match(source,/const duplicado=await Movimiento\.findOne\(\{empresaId,sedeId,operacionId\}\)\.session\(session\)/);
 assert.match(source,/UnknownTransactionCommitResult/);
 assert.match(source,/error\?\.code===11000/);
 assert.match(source,/const confirmed=await recuperar\(\)/);
});
