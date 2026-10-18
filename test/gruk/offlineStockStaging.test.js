"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {stageOfflineStockMovements:stage}=require("../../core/offline/offlineStockStaging.service");
const a="01ARZ3NDEKTSV4RRFFQ69G5FA0",p="507f1f77bcf86cd799439011";
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const plan={orders:[{eventId:a,items:[{productoId:p,cantidad:"2"}]}]};
const inventoryDeltas=[{productoId:p,deltaUnidades:"-2"}];
function make(ready=true){
 const rows=new Map();const session={inTransaction:()=>true};
 const db={collection:()=>({
  indexes:async()=>ready?[{name:"uniq_offline_stock_tenant_batch_product",unique:true,key:{empresaId:1,sedeId:1,batchId:1,productoId:1}}]:[],
  updateOne:async(k,u,opt)=>{assert.equal(opt.session,session);const id=k.batchId+":"+k.productoId;if(rows.has(id))return {upsertedCount:0};rows.set(id,u.$setOnInsert);return {upsertedCount:1};},
  findOne:async k=>rows.get(k.batchId+":"+k.productoId)
 })};return {db,session,rows};
}
test("almacena movimiento de stock una vez y reintento no duplica",async()=>{
 const f=make();const first=await stage({...f,context,plan,inventoryDeltas});
 const again=await stage({...f,context,plan,inventoryDeltas});
 assert.equal(first.records[0].inserted,true);assert.equal(again.records[0].inserted,false);
 assert.equal(f.rows.size,1);assert.equal([...f.rows.values()][0].deltaUnidades,"-2");
});
test("rechaza descuento falsificado antes de escribir",async()=>{
 const f=make();
 await assert.rejects(stage({...f,context,plan,inventoryDeltas:[{productoId:p,deltaUnidades:"-1"}]}),e=>e.code==="OFFLINE_STOCK_TOTAL_CONFLICT");
 assert.equal(f.rows.size,0);
});
test("rechaza si no existe índice único",async()=>{
 const f=make(false);
 await assert.rejects(stage({...f,context,plan,inventoryDeltas}),e=>e.code==="OFFLINE_STOCK_UNIQUE_INDEX_REQUIRED");
 assert.equal(f.rows.size,0);
});
