"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {postOfflineLedgerBatch:post}=require("../../core/offline/offlineLedgerBatchPoster.service");
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const a="01ARZ3NDEKTSV4RRFFQ69G5FA0",b="01ARZ3NDEKTSV4RRFFQ69G5FA1";
const movements=[{eventId:a,tipo:"VENTA_OFFLINE",montoCop:"1000"},{eventId:b,tipo:"VENTA_OFFLINE",montoCop:"2000"}];
function fixture(){
 const writes=[];const session={inTransaction:()=>true};
 const db={collection(name){assert.equal(name,"gruk_ledger_movimientos");return {
  indexes:async()=>[{name:"uniq_offline_ledger_event_type_tenant",unique:true,key:{empresaId:1,sedeId:1,eventId:1,tipo:1}}],
  updateOne:async(k,u,o)=>{assert.equal(o.session,session);writes.push({key:k,payload:u.$setOnInsert});return {acknowledged:true,upsertedCount:1};}
 };}};
 return {db,session,writes};
}
test("registrar dos movimientos ledger sin salir de sesión de Mongo",async()=>{
 const f=fixture();const result=await post({...f,context,ledgerMovements:movements});
 assert.equal(result.totalCop,"3000");assert.equal(result.entries.length,2);assert.equal(f.writes.length,2);
 assert.deepEqual(f.writes.map(x=>x.payload.montoCop),["1000","2000"]);
});
test("rechaza duplicados de evento antes de escribir cualquier movimiento",async()=>{
 const f=fixture();
 await assert.rejects(post({...f,context,ledgerMovements:[movements[0],movements[0]]}),
 e=>e.code==="OFFLINE_LEDGER_BATCH_INVALID");
 assert.equal(f.writes.length,0);
});
test("rechaza la ejecución fuera de una transacción abierta",async()=>{
 const f=fixture();
 await assert.rejects(post({...f,session:{inTransaction:()=>false},context,ledgerMovements:movements}),
 e=>e.code==="OFFLINE_LEDGER_BATCH_INVALID");
 assert.equal(f.writes.length,0);
});

test("Capa 2: ledger offline rechaza COP enormes y planes dispersos sin escribir",async()=>{
 const malformed=[
  [{...movements[0],montoCop:"9".repeat(10000)}],
  [{...movements[0],montoCop:"9".repeat(10000)+"x"}],
  [{...movements[0],montoCop:"9007199254740992"}],
  [movements[0],,movements[1]],
  new Array(1)
 ];
 for(const ledgerMovements of malformed){
  const f=fixture();
  await assert.rejects(post({...f,context,ledgerMovements}),
   {code:"OFFLINE_LEDGER_BATCH_INVALID"});
  assert.deepEqual(f.writes,[]);
 }
 const f=fixture();
 const ok=await post({...f,context,ledgerMovements:[{...movements[0],
  montoCop:"9007199254740991"}]});
 assert.equal(ok.totalCop,"9007199254740991");
 assert.equal(f.writes.length,1);
});

test("Capa 2: ledger rejects unscoped company, site, actor and invalid ULIDs before Mongo",async()=>{
 const invalid=[
  {context:null,ledgerMovements:movements},
  {context:{...context,empresaId:undefined},ledgerMovements:movements},
  {context:{...context,sedeId:{$ne:null}},ledgerMovements:movements},
  {context:{...context,actorId:"$admin"},ledgerMovements:movements},
  {context,ledgerMovements:[{...movements[0],eventId:"not-an-ulid"}]},
  {context,ledgerMovements:[movements[0],{...movements[1],eventId:"wrong"}]}
 ];
 for(const args of invalid){
  let access=0;
  const db={collection(){access++;throw Error("UNAUTHORIZED_LEDGER_WRITE");}};
  await assert.rejects(post({db,session:{inTransaction:()=>true},...args}),
    {code:"OFFLINE_LEDGER_BATCH_INVALID"});
  assert.equal(access,0);
 }
});

test("Capa 2: ledger batch bloquea getters de identidad sin consultar Mongo",async()=>{
 for(const field of ["empresaId","sedeId","actorId"]){
  let getters=0,collections=0;
  const ctx={...context};
  Object.defineProperty(ctx,field,{enumerable:true,configurable:true,
   get(){getters++;return "empresaAjena";}});
  const db={collection(){collections++;throw Error("UNAUTHORIZED_DB_ACCESS");}};
  await assert.rejects(post({db,context:ctx,session:{inTransaction:()=>true},
   ledgerMovements:movements}),{code:"OFFLINE_LEDGER_BATCH_INVALID"});
  assert.equal(getters,0,field);
  assert.equal(collections,0,field);
 }
});
test("Capa 2: getter de movimiento o índice rechaza todo el lote sin escrituras",async()=>{
 for(const key of ["eventId","tipo","montoCop"]){
  let hits=0;
  const poisoned={...movements[0]};
  Object.defineProperty(poisoned,key,{enumerable:true,configurable:true,
    get(){hits++;return movements[0][key];}});
  const f=fixture();
  await assert.rejects(post({...f,context,ledgerMovements:[poisoned]}),
   {code:"OFFLINE_LEDGER_BATCH_INVALID"});
  assert.equal(hits,0,key);
  assert.equal(f.writes.length,0);
 }
 let accessed=0;
 const records=[movements[0]];
 Object.defineProperty(records,0,{enumerable:true,configurable:true,
  get(){accessed++;return movements[0];}});
 const f=fixture();
 await assert.rejects(post({...f,context,ledgerMovements:records}),
  {code:"OFFLINE_LEDGER_BATCH_INVALID"});
 assert.equal(accessed,0);
 assert.equal(f.writes.length,0);
});
test("Capa 2: mutar el lote durante el primer write no altera el segundo",async()=>{
 const original=[{...movements[0]},{...movements[1]}];
 const ctx={...context};
 const ledgerMovements=original.map(x=>({...x}));
 const updates=[];
 const session={inTransaction:()=>true};
 const db={collection(name){
  assert.equal(name,"gruk_ledger_movimientos");
  return {
   indexes:async()=>[{name:"uniq_offline_ledger_event_type_tenant",
    unique:true,key:{empresaId:1,sedeId:1,eventId:1,tipo:1}}],
   async updateOne(key,change,opts){
    assert.equal(opts.session,session);
    updates.push({key:{...key},body:{...change.$setOnInsert}});
    if(updates.length===1){
     Object.assign(ctx,{empresaId:"otraEmpresa",sedeId:"otraSede",actorId:"intruso"});
     Object.assign(ledgerMovements[1],{eventId:a,montoCop:"999999"});
     ledgerMovements[1]=null;
    }
    return {acknowledged:true,upsertedCount:1};
   }
  };
 }};
 const result=await post({db,session,context:ctx,ledgerMovements});
 assert.equal(result.totalCop,"3000");
 assert.equal(updates.length,2);
 assert.deepEqual(updates.map(x=>x.key.eventId),[a,b]);
 assert.deepEqual(updates.map(x=>x.body.montoCop),["1000","2000"]);
 for(const update of updates){
  assert.equal(update.key.empresaId,"empresa");
  assert.equal(update.key.sedeId,"sede");
  assert.equal(update.body.actorId,"cajero");
 }
});
