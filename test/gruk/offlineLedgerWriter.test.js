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
    if(records.has(id))return {acknowledged:true,upsertedCount:0};
    records.set(id,update.$setOnInsert);return {acknowledged:true,upsertedCount:1};
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
     return {acknowledged:true,upsertedCount:0};
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

test("Capa 2: ledger writer rechaza montos enormes antes de leer Mongo",async()=>{
 for(const montoCop of ["9".repeat(10000),"1".repeat(10000)+"x","9007199254740992"]){
  let collections=0;
  const db={collection(){collections++;throw Error("FORBIDDEN_DB_ACCESS");}};
  await assert.rejects(append({db,session:{inTransaction:()=>true},
   context,eventId,movement:{...movement,montoCop}}),
   {code:"OFFLINE_LEDGER_INVALID_MOVEMENT"});
  assert.equal(collections,0);
 }
 const f=setup();
 const accepted=await append({...f,context,eventId,
  movement:{...movement,montoCop:"9007199254740991"}});
 assert.equal(accepted.inserted,true);
 assert.equal(f.records.size,1);
});

test("Capa 2: acuse de escritura ledger ausente o ambiguo falla sin reinterpretar replay",async()=>{
 for(const result of [null,undefined,{}, {upsertedCount:null},
   {upsertedCount:2},{upsertedCount:-1},{upsertedCount:"1"}]){
  let lookups=0;
  const session={inTransaction:()=>true};
  const db={collection:()=>({
   indexes:async()=>[{name:"uniq_offline_ledger_event_type_tenant",
     unique:true,key:{empresaId:1,sedeId:1,eventId:1,tipo:1}}],
   updateOne:async()=>result,
   findOne:async()=>{lookups++;throw Error("FORBIDDEN_REPLAY_LOOKUP");}
  })};
  await assert.rejects(append({db,session,context,eventId,movement}),
   {code:"OFFLINE_LEDGER_WRITE_UNVERIFIED"});
  assert.equal(lookups,0);
 }
});

test("Capa 2: índices ledger con entradas corruptas fallan cerrado sin escrituras",async()=>{
 for(const metadata of [null,undefined,{},[null],[false],[undefined],[{name:"irrelevant"},null]]){
  let writes=0;
  const db={collection:()=>({
   indexes:async()=>metadata,
   updateOne:async()=>{writes++;throw Error("FORBIDDEN_LEDGER_WRITE");}
  })};
  await assert.rejects(append({db,session:{inTransaction:()=>true},context,eventId,movement}),
   {code:"OFFLINE_LEDGER_UNIQUE_INDEX_REQUIRED"});
  assert.equal(writes,0);
 }
});

test("Capa 2: rechazo de escritura no reconocida sin lectura de replay",async()=>{
 for(const upsertedCount of [0,1]){
  let replayReads=0;
  const db={collection:()=>({
   indexes:async()=>[{name:"uniq_offline_ledger_event_type_tenant",unique:true,key:{empresaId:1,sedeId:1,eventId:1,tipo:1}}],
   updateOne:async()=>({acknowledged:false,upsertedCount}),
   findOne:async()=>{replayReads++;throw Error("UNCONFIRMED_REPLAY_READ");}
  })};
  await assert.rejects(append({db,session:{inTransaction:()=>true},context,eventId,movement}),{code:"OFFLINE_LEDGER_WRITE_UNVERIFIED"});
  assert.equal(replayReads,0);
 }
});
