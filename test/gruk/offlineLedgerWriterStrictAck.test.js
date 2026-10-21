"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {appendOfflineLedgerEvent}=require("../../core/offline/offlineLedgerWriter.service");
const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"operator"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0",movement={tipo:"VENTA_OFFLINE",montoCop:"3000"};
const session={inTransaction:()=>true};
function fixture(response){
 let writes=0,reads=0;
 const db={collection(name){
  assert.equal(name,"gruk_ledger_movimientos");
  return {indexes:async()=>[{name:"uniq_offline_ledger_event_type_tenant",
   key:{empresaId:1,sedeId:1,eventId:1,tipo:1},unique:true}],
   updateOne:async(key,update,opts)=>{
    writes++;assert.equal(opts.session,session);
    assert.equal(key.empresaId,context.empresaId);assert.equal(key.sedeId,context.sedeId);
    assert.equal(update.$setOnInsert.deletedAt,null);
    return response;
   },
   findOne:async()=>{reads++;throw Error("NO_UNVERIFIED_REPLAY");}
  };
 }};
 return {db,get writes(){return writes;},get reads(){return reads;}};
}
test("Capa 2: ledger rechaza acuse no confirmado sin consultar repetición",async()=>{
 for(const response of [undefined,null,{}, {upsertedCount:1},{upsertedCount:0},
  {acknowledged:false,upsertedCount:1},{acknowledged:1,upsertedCount:1},
  {acknowledged:true,upsertedCount:2}]){
  const f=fixture(response);
  await assert.rejects(appendOfflineLedgerEvent({db:f.db,session,context,eventId,movement}),
   {code:"OFFLINE_LEDGER_WRITE_UNVERIFIED"});
  assert.equal(f.writes,1);assert.equal(f.reads,0);
 }
});
test("Capa 2: inserción confirmada mantiene ledger append-only y total exacto",async()=>{
 const f=fixture({acknowledged:true,upsertedCount:1});
 assert.deepEqual(await appendOfflineLedgerEvent({db:f.db,session,context,eventId,movement}),
  {eventId,tipo:"VENTA_OFFLINE",inserted:true});
 assert.equal(f.writes,1);assert.equal(f.reads,0);
});
