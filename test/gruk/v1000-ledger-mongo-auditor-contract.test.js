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
