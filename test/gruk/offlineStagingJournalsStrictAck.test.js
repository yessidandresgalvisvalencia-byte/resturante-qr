"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {stageOfflineSales}=require("../../core/offline/offlineSalesStaging.service");
const {stageOfflineCashIntents}=require("../../core/offline/offlineCashStaging.service");
const {stageOfflineStockMovements}=require("../../core/offline/offlineStockStaging.service");
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operator"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0",productoId="507f1f77bcf86cd799439011";
const plan={orders:[{eventId,localOrderId:eventId,totalCop:"3000",items:[{productoId,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}],totalCop:"3000"};
const inventoryDeltas=[{productoId,deltaUnidades:"-1"}],session={inTransaction:()=>true};
const writers=[
 ["sales",stageOfflineSales,"uniq_offline_sale_tenant_event",{empresaId:1,sedeId:1,eventId:1},"OFFLINE_SALES_WRITE_UNVERIFIED"],
 ["cash",stageOfflineCashIntents,"uniq_offline_cash_tenant_event",{empresaId:1,sedeId:1,eventId:1},"OFFLINE_CASH_WRITE_UNVERIFIED"],
 ["stock",stageOfflineStockMovements,"uniq_offline_stock_tenant_batch_product",{empresaId:1,sedeId:1,batchId:1,productoId:1},"OFFLINE_STOCK_WRITE_UNVERIFIED"]
];
function fixture(indexName,key,reply){
 let writes=0,reads=0;
 return {get writes(){return writes;},get reads(){return reads;},db:{collection(){
  return {indexes:async()=>[{name:indexName,unique:true,key}],
   async updateOne(filter,update,options){
    writes++;assert.equal(options.upsert,true);assert.equal(options.session,session);
    assert.equal(filter.empresaId,context.empresaId);assert.equal(filter.sedeId,context.sedeId);
    assert.equal(update.$setOnInsert.actorId,context.actorId);
    return reply;
   },
   async findOne(){reads++;throw Error("UNVERIFIED_REPLAY_PROOF");}
  };
 }}};
}
test("Capa 2: los tres diarios fallan cerrados ante acuse ausente o falso",async()=>{
 for(const [name,write,indexName,key,errorCode] of writers){
  for(const reply of [null,{}, {upsertedCount:1},{acknowledged:false,upsertedCount:1},
   {acknowledged:1,upsertedCount:1},{acknowledged:true,upsertedCount:2}]){
   const f=fixture(indexName,key,reply);
   await assert.rejects(write({db:f.db,session,context,plan,inventoryDeltas}),{code:errorCode},name);
   assert.equal(f.writes,1,name);assert.equal(f.reads,0,name);
  }
 }
});
test("Capa 2: acuse verdadero y una inserción permiten staging sin cobro",async()=>{
 for(const [name,write,indexName,key] of writers){
  const f=fixture(indexName,key,{acknowledged:true,upsertedCount:1});
  const result=await write({db:f.db,session,context,plan,inventoryDeltas});
  assert.equal(result.records[0].inserted,true,name);
  assert.equal(f.writes,1,name);assert.equal(f.reads,0,name);
 }
});
