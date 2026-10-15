"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Ledger=require("../../models/MovimientoLedgerV1000");
test("Ledger V1000 rechaza save de documento existente antes de tocar MongoDB",async()=>{
 const document=new Ledger({empresaId:"A",sedeId:"B",id:"X",operacionId:"OP",tipo:"CREDITO",montoCentavos:100,antesCentavos:0,despuesCentavos:100,actorId:"U",ip:"127.0.0.1",timestamp:new Date(),hashAnterior:"0".repeat(64),hash:"1".repeat(64),secuencia:1,deletedAt:null});
 document.isNew=false;
 await assert.rejects(document.save(),/LEDGER_APPEND_ONLY/);
});
test("Ledger V1000 bloquea operaciones bulkWrite en el modelo",async()=>{
 await assert.rejects(Ledger.bulkWrite([{deleteMany:{filter:{}}}]),/LEDGER_BULK_WRITE_PROHIBIDO/);
});

test("Ledger V1000 exige deletedAt nulo y rechaza un borrado lógico",async()=>{
 const document=new Ledger({empresaId:"A",sedeId:"B",id:"X",tipo:"CREDITO",montoCentavos:100,antesCentavos:0,despuesCentavos:100,actorId:"U",ip:"127.0.0.1",timestamp:new Date(),hashAnterior:"0".repeat(64),hash:"1".repeat(64),secuencia:1,deletedAt:new Date()});
 await assert.rejects(document.validate(),/LEDGER_DELETED_AT_PROHIBIDO/);
});
