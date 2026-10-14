"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("Replay histórico verifica todos los enlaces mediante la auditoría de cadena en snapshot",()=>{
 const block=source.slice(source.indexOf("async function recuperar()"),source.indexOf("const previo=await recuperar()"));
 assert.match(block,/Movimiento\.find\(\{empresaId,sedeId\}\)/);
 assert.match(block,/\.sort\(\{secuencia:1\}\)\.limit\(MAX_REPLAY_AUDIT\+1\)\.session\(lectura\)\.lean\(\)\.cursor\(\{batchSize:500\}\)/);
 assert.match(block,/verificador\.finalizar\(head\)/);
 assert.match(block,/LEDGER_REPLAY_REQUIERE_AUDITORIA_PARTICIONADA/);
});
