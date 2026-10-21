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
