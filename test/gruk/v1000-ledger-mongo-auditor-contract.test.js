"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../services/auditarLedgerV1000.service.js"),"utf8");
test("Auditoria de cadena en Mongo exige tenant en todas las lecturas",()=>{
 assert.match(src,/tenant\.parse\(\{empresaId,sedeId\}\)/);
 assert.match(src,/Saldo\.findOne\(\{empresaId,sedeId\}\)/);
 assert.match(src,/Movimiento\.find\(\{empresaId,sedeId\}\)/);
});
test("Auditoria rechaza historiales truncados o excesivos",()=>{
 assert.match(src,/head\.secuencia>maxAsientos/);
 assert.match(src,/asientos\.length>maxAsientos/);
 assert.match(src,/verificarCadena\(\{empresaId,sedeId,asientos,cabecera:head\}\)/);
});

test("Auditoria lee cabecera e historial dentro de una misma snapshot ACID",()=>{
 assert.match(src,/session\.withTransaction/);
 assert.match(src,/Saldo\.findOne\(\{empresaId,sedeId\}\)\.session\(session\)/);
 assert.match(src,/\.limit\(maxAsientos\+1\)\.session\(session\)/);
 assert.match(src,/readConcern:\{level:"snapshot"\}/);
 assert.match(src,/await session\.endSession\(\)/);
});
