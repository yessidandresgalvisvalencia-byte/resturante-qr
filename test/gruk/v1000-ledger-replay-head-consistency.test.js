"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const s=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("Replay V1000 exige cabecera y lectura snapshot consistente",()=>{
 const body=s.slice(s.indexOf("async function recuperar()"),s.indexOf("const previo=await recuperar()"));
 assert.match(body,/Saldo\.findOne\(\{empresaId,sedeId\}\)\.session\(lectura\)\.lean\(\)/);
 assert.match(body,/head\.secuencia<existing\.secuencia/);
 assert.match(body,/readConcern:\{level:"snapshot"\}/);
 assert.match(body,/await lectura\.endSession\(\)/);
});
test("Replay verifica cabecera, saldo y hash mediante auditoría íntegra, sin lecturas redundantes",()=>{
 const body=s.slice(s.indexOf("async function recuperar()"),s.indexOf("const previo=await recuperar()"));
 assert.match(body,/verificarCadena\(\{empresaId,sedeId,asientos:historial,cabecera:head\}\)/);
 assert.match(body,/LEDGER_REPLAY_CADENA_INVALIDA/);
 assert.doesNotMatch(body,/const ultimo=await Movimiento\.findOne/);
});
