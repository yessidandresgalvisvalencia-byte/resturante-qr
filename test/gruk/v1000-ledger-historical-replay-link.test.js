"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("Replay de asiento histórico comprueba continuidad con sucesor dentro de snapshot",()=>{
 const start=source.indexOf("async function recuperar()");
 const end=source.indexOf("const previo=await recuperar()",start);
 const block=source.slice(start,end);
 assert.match(block,/Movimiento\.findOne\(\{empresaId,sedeId,secuencia:existing\.secuencia\+1\}\)/);
 assert.match(block,/\.session\(lectura\)\.lean\(\)/);
 assert.match(block,/siguiente\.hashAnterior!==existing\.hash/);
 assert.match(block,/siguiente\.antesCentavos!==existing\.despuesCentavos/);
 assert.match(block,/hashMovimiento\(siguiente\)!==siguiente\.hash/);
});
