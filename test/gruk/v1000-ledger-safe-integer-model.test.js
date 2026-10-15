"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Ledger=require("../../models/MovimientoLedgerV1000");
const base={id:"01ARZ3NDEKTSV4RRFFQ69G5FAV",operacionId:"01ARZ3NDEKTSV4RRFFQ69G5FBB",empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAX",tipo:"CREDITO",secuencia:1,montoCentavos:1,antesCentavos:0,despuesCentavos:1,actorId:"01ARZ3NDEKTSV4RRFFQ69G5FAY",ip:"127.0.0.1",timestamp:new Date(),hashAnterior:"0".repeat(64),hash:"1".repeat(64),deletedAt:null};
test("Ledger V1000 rechaza floats, negativos e importes inseguros desde el modelo",()=>{
 for(const patch of [{montoCentavos:1.01},{montoCentavos:-1},{montoCentavos:Number.MAX_SAFE_INTEGER+1},{antesCentavos:-1},{despuesCentavos:1.1},{secuencia:1.5}]){
  const document=new Ledger({...base,...patch});
  assert.ok(document.validateSync(),JSON.stringify(patch));
 }
 assert.equal(new Ledger(base).validateSync(),undefined);
});
