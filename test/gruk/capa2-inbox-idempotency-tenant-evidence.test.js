"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {acceptOfflineBatch,digest}=require("../../core/offline/offlineInbox.service");
const tenant={empresaId:"empresaA",sedeId:"sedeA",actorId:"operator"};
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const event={...tenant,eventId:id,tipo:"PEDIDO_REGISTRADO",payload:{localOrderId:id,items:[{productoId:"507f1f77bcf86cd799439011",cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"}};
function store(patch={},mode="preflight"){
 let writes=0;
 return {get writes(){return writes;},db:{collection(name){
  assert.equal(name,"gruk_offline_inbox");
  return {
   async findOne(query,opts){
    assert.equal(query.empresaId,tenant.empresaId);
    assert.equal(query.sedeId,tenant.sedeId);
    assert.equal(opts.projection.empresaId,1);
    assert.equal(opts.projection.sedeId,1);
    assert.equal(opts.projection.eventId,1);
    if(mode==="postwrite"&&writes===0)return null;
    return {...tenant,eventId:id,eventHash:digest(event),...patch};
   },
   async updateOne(query,update){
    assert.equal(query.empresaId,tenant.empresaId);
    assert.equal(query.sedeId,tenant.sedeId);
    writes++;
    return {upsertedCount:0};
   }
  };
 }}};
}
test("Capa 2: valid offline event replay retains idempotency",async()=>{
 const s=store();
 assert.deepEqual(await acceptOfflineBatch({db:s.db,authenticatedContext:tenant,events:[event]}),[
  {eventId:id,status:"YA_RECIBIDO"}
 ]);
 assert.equal(s.writes,1);
});
test("Capa 2: foreign event row blocks writes during preflight",async()=>{
 for(const patch of [{empresaId:"empresaB"},{sedeId:"sedeB"},
  {actorId:"otro"},{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"},
  {empresaId:undefined},{sedeId:undefined},{eventId:undefined}]){
  const s=store(patch);
  await assert.rejects(acceptOfflineBatch({db:s.db,authenticatedContext:tenant,events:[event]}),
   {code:"OFFLINE_EVENT_CONFLICT"});
  assert.equal(s.writes,0);
 }
});
test("Capa 2: postwrite idempotency never accepts forged persisted identity",async()=>{
 for(const patch of [{empresaId:"empresaB"},{sedeId:"sedeB"},
  {actorId:"otro"},{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1"}]){
  const s=store(patch,"postwrite");
  await assert.rejects(acceptOfflineBatch({db:s.db,authenticatedContext:tenant,events:[event]}),
   {code:"OFFLINE_EVENT_CONFLICT"});
  assert.equal(s.writes,1);
 }
});
