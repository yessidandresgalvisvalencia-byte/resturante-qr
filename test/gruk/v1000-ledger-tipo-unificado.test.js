"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const fs=require("node:fs");
const path=require("node:path");
test("Ledger V1000 prohíbe AJUSTE fuera de los tipos auditables",()=>{
 const doc=new Movimiento({
  id:"01ARZ3NDEKTSV4RRFFQ69G5FAV",empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",
  sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",tipo:"AJUSTE",secuencia:1,
  montoCentavos:1,antesCentavos:0,despuesCentavos:1,
  actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",ip:"127.0.0.1",timestamp:new Date(),
  hashAnterior:"0".repeat(64),hash:"1".repeat(64),deletedAt:null
 });
 assert.ok(doc.validateSync()?.errors.tipo);
 const validation=fs.readFileSync(path.join(__dirname,"../../core/finance/v1000/validation.js"),"utf8");
 assert.match(validation,/tipo:z\.enum\(\["CREDITO","DEBITO"\]\)/);
 assert.doesNotMatch(validation,/\["CREDITO","DEBITO","AJUSTE"\]/);
});
