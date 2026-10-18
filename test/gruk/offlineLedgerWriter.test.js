"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {appendOfflineLedgerEvent:append}=require("../../core/offline/offlineLedgerWriter.service");
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const movement={tipo:"VENTA",montoCop:"3000"};
function setup(){
 const records=new Map();
 const session={inTransaction:()=>true};
 const db={collection(name){
  assert.equal(name,"gruk_ledger_movimientos");
  return {
   async updateOne(key,update,opts){
    assert.equal(opts.session,session);
    const id=key.empresaId+":"+key.sedeId+":"+key.eventId+":"+key.tipo;
    if(records.has(id))return {upsertedCount:0};
    records.set(id,update.$setOnInsert);return {upsertedCount:1};
   },
   async findOne(key){return records.get(key.empresaId+":"+key.sedeId+":"+key.eventId+":"+key.tipo);}
  };
 }};
 return {db,session,records};
}
test("ledger offline: primer movimiento inserta y reintento idéntico no duplica",async()=>{
 const fixture=setup();
 assert.equal((await append({...fixture,context,eventId,movement})).inserted,true);
 assert.equal((await append({...fixture,context,eventId,movement})).inserted,false);
 assert.equal(fixture.records.size,1);
});
test("ledger offline: reintento con importe diferente genera conflicto",async()=>{
 const fixture=setup();
 await append({...fixture,context,eventId,movement});
 await assert.rejects(append({...fixture,context,eventId,movement:{...movement,montoCop:"3001"}}),
   e=>e.code==="OFFLINE_LEDGER_REPLAY_CONFLICT");
});
test("ledger offline: prohíbe escribir sin transacción real y rechaza montos float",async()=>{
 const fixture=setup();
 await assert.rejects(append({...fixture,session:{inTransaction:()=>false},context,eventId,movement}),
  e=>e.code==="OFFLINE_LEDGER_TRANSACTION_REQUIRED");
 await assert.rejects(append({...fixture,context,eventId,movement:{tipo:"VENTA",montoCop:3.5}}),
  e=>e.code==="OFFLINE_LEDGER_INVALID_MOVEMENT");
});
