"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {stageOfflineSales:stage}=require("../../core/offline/offlineSalesStaging.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const plan={orders:[{eventId,localOrderId:eventId,totalCop:"3000",items:[{productoId:"507f1f77bcf86cd799439011",cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}],totalCop:"3000"};
function fixture(indexReady=true){
 const data=new Map();const session={inTransaction:()=>true};
 const db={collection:name=>{
  assert.equal(name,"gruk_offline_ventas");
  return {indexes:async()=>indexReady?[{name:"uniq_offline_sale_tenant_event",unique:true,key:{empresaId:1,sedeId:1,eventId:1}}]:[],
  updateOne:async(key,update,opts)=>{assert.equal(opts.session,session);if(data.has(key.eventId))return {upsertedCount:0};
   data.set(key.eventId,update.$setOnInsert);return {upsertedCount:1};},
  findOne:async key=>data.get(key.eventId)};
 }};
 return {db,session,data};
}
test("escribe venta pendiente una vez y reintento idéntico no duplica",async()=>{
 const f=fixture();const first=await stage({...f,context,plan});const retry=await stage({...f,context,plan});
 assert.equal(first.records[0].inserted,true);assert.equal(retry.records[0].inserted,false);
 assert.equal(f.data.size,1);assert.equal(f.data.get(eventId).totalCop,"3000");
});
test("falla cerrado si falta índice único y no inserta",async()=>{
 const f=fixture(false);
 await assert.rejects(stage({...f,context,plan}),e=>e.code==="OFFLINE_SALES_UNIQUE_INDEX_REQUIRED");
 assert.equal(f.data.size,0);
});
test("detecta reintento con importe incompatible",async()=>{
 const f=fixture();await stage({...f,context,plan});
 const changed={...plan,orders:[{...plan.orders[0],totalCop:"3001"}],totalCop:"3001"};
 await assert.rejects(stage({...f,context,plan:changed}),e=>e.code==="OFFLINE_SALES_REPLAY_CONFLICT");
});
test("rechaza importe agregado incorrecto antes de escribir",async()=>{
 const f=fixture();
 await assert.rejects(stage({...f,context,plan:{...plan,totalCop:"2999"}}),e=>e.code==="OFFLINE_SALES_TOTAL_CONFLICT");
 assert.equal(f.data.size,0);
});
