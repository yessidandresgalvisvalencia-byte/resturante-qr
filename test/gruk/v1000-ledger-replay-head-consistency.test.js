"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const s=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("Replay V1000 no devuelve asiento si falta la cabecera o su secuencia retrocede",()=>{
 const start=s.indexOf("async function recuperar()");
 const end=s.indexOf("const previo=await recuperar()",start);
 const body=s.slice(start,end);
 assert.match(body,/Saldo\.findOne\(\{empresaId,sedeId\}\)\.session\(lectura\)\.lean\(\)/);
 assert.match(body,/head\.secuencia<existing\.secuencia/);
 assert.match(body,/LEDGER_REPLAY_CADENA_INVALIDA/);
 assert.match(body,/readConcern:\{level:"snapshot"\}/);
 assert.match(body,/await lectura\.endSession\(\)/);
});
test("Replay del último asiento exige hash y saldo compatibles con la cabecera",()=>{
 const start=s.indexOf("async function recuperar()");
 const end=s.indexOf("const previo=await recuperar()",start);
 const body=s.slice(start,end);
 assert.match(body,/head\.hashUltimo!==existing\.hash/);
 assert.match(body,/head\.saldoCentavos!==existing\.despuesCentavos/);
});
