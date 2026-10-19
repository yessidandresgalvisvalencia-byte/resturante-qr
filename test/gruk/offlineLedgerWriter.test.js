"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {appendOfflineLedgerEvent:append}=require("../../core/offline/offlineLedgerWriter.service");
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const movement={tipo:"VENTA",montoCop:"3000"};
function setup(indexReady=true){
 const records=new Map();
 const session={inTransaction:()=>true};
 const db={collection(name){
  assert.equal(name,"gruk_ledger_movimientos");
  return {
   async indexes(){return indexReady?[{name:"uniq_offline_ledger_event_type_tenant",unique:true,key:{empresaId:1,sedeId:1,eventId:1,tipo:1}}]:[];},
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

test("ledger offline: no escribe si índice único todavía no existe",async()=>{
 const fixture=setup(false);
 await assert.rejects(append({...fixture,context,eventId,movement}),
  e=>e.code==="OFFLINE_LEDGER_UNIQUE_INDEX_REQUIRED");
 assert.equal(fixture.records.size,0);
});

test("E11000 no consulta una transacción abortada ni confunde colisión con éxito",async()=>{
 let findCount=0;
 const session={inTransaction:()=>true};
 const db={collection:()=>({
  indexes:async()=>[{name:"uniq_offline_ledger_event_type_tenant",unique:true,key:{empresaId:1,sedeId:1,eventId:1,tipo:1}}],
  updateOne:async()=>{const e=new Error("duplicate key");e.code=11000;throw e;},
  findOne:async()=>{findCount++;throw Error("ABORTED_TRANSACTION");}
 })};
 await assert.rejects(append({db,session,context,eventId,movement}),
  e=>e.code==="OFFLINE_LEDGER_CONCURRENT_RETRY_REQUIRED");
 assert.equal(findCount,0);
});

test("Capa 2: ledger replay rejects cross-tenant or altered persisted identity",async()=>{
 for(const patch of [
  {empresaId:"empresa-ajena"},{sedeId:"sede-ajena"},
  {eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"},{tipo:"AJUSTE"},
  {actorId:"actor-ajeno"},{empresaId:undefined},{sedeId:undefined},
  {eventId:undefined},{tipo:undefined},{deletedAt:new Date()}
 ]){
  let writes=0;
  const session={inTransaction:()=>true};
  const db={collection(name){
   assert.equal(name,"gruk_ledger_movimientos");
   return {
    async indexes(){return [{name:"uniq_offline_ledger_event_type_tenant",unique:true,
      key:{empresaId:1,sedeId:1,eventId:1,tipo:1}}];},
    async updateOne(key,update,opts){
     assert.equal(opts.session,session);
     assert.equal(key.empresaId,context.empresaId);
     assert.equal(key.sedeId,context.sedeId);
     writes++;
     return {upsertedCount:0};
    },
    async findOne(key,opts){
     assert.equal(opts.session,session);
     for(const field of ["empresaId","sedeId","eventId","tipo"])
      assert.equal(opts.projection[field],1);
     return {...key,actorId:context.actorId,montoCop:movement.montoCop,
      deletedAt:null,...patch};
    }
   };
  }};
  await assert.rejects(append({db,session,context,eventId,movement}),
    {code:"OFFLINE_LEDGER_REPLAY_CONFLICT"});
  assert.equal(writes,1);
 }
});
