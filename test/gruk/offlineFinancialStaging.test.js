"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {stageOfflineFinancialBatch:stage}=require("../../core/offline/offlineFinancialStaging.service");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0",p="507f1f77bcf86cd799439011";
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const plan={orders:[{eventId:id,localOrderId:id,totalCop:"3000",items:[{productoId:p,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}],totalCop:"3000"};
const inventoryDeltas=[{productoId:p,deltaUnidades:"-1"}],ledgerMovements=[{eventId:id,tipo:"VENTA_OFFLINE",montoCop:"3000"}];
function fixture(failOn){
 const writes=[];const session={inTransaction:()=>true};const collections={
  gruk_offline_ventas:{name:"uniq_offline_sale_tenant_event",key:{empresaId:1,sedeId:1,eventId:1}},
  gruk_offline_stock_movimientos:{name:"uniq_offline_stock_tenant_batch_product",key:{empresaId:1,sedeId:1,batchId:1,productoId:1}},
  gruk_offline_caja_intenciones:{name:"uniq_offline_cash_tenant_event",key:{empresaId:1,sedeId:1,eventId:1}},
  gruk_ledger_movimientos:{name:"uniq_offline_ledger_event_type_tenant",key:{empresaId:1,sedeId:1,eventId:1,tipo:1}}
 };
 const db={collection(name){const i=collections[name];assert.ok(i);return{
  indexes:async()=>[{name:i.name,key:i.key,unique:true}],
  updateOne:async(_key,update,opts)=>{assert.equal(opts.session,session);if(name===failOn)throw Error("POSTING_FAILED");
   writes.push({collection:name,payload:update.$setOnInsert});return {upsertedCount:1};}
 };}};
 return {db,session,writes};
}
test("ventas inventario caja y ledger usan misma sesión y monto COP",async()=>{
 const f=fixture();const result=await stage({...f,context,plan,inventoryDeltas,ledgerMovements});
 assert.equal(result.status,"PENDIENTE_CONTABILIZACION");
 assert.equal(result.sales.totalCop,"3000");assert.equal(result.cash.totalCop,"3000");
 assert.equal(result.ledger.totalCop,"3000");assert.equal(result.cash.records.length,1);
 assert.equal(f.writes.find(x=>x.collection==="gruk_offline_caja_intenciones").payload.cobrado,false);
 assert.deepEqual(f.writes.map(x=>x.collection),["gruk_offline_ventas","gruk_offline_stock_movimientos","gruk_offline_caja_intenciones","gruk_ledger_movimientos"]);
});
test("si stock falla no llega a caja ni ledger",async()=>{
 const f=fixture("gruk_offline_stock_movimientos");
 await assert.rejects(stage({...f,context,plan,inventoryDeltas,ledgerMovements}),/POSTING_FAILED/);
 assert.deepEqual(f.writes.map(x=>x.collection),["gruk_offline_ventas"]);
});
test("si caja falla no llega al ledger",async()=>{
 const f=fixture("gruk_offline_caja_intenciones");
 await assert.rejects(stage({...f,context,plan,inventoryDeltas,ledgerMovements}),/POSTING_FAILED/);
 assert.deepEqual(f.writes.map(x=>x.collection),["gruk_offline_ventas","gruk_offline_stock_movimientos"]);
});
test("rechaza sesión sin transacción antes de hacer operaciones",async()=>{
 const f=fixture();await assert.rejects(stage({...f,session:{inTransaction:()=>false},context,plan,inventoryDeltas,ledgerMovements}),
 e=>e.code==="OFFLINE_STAGING_TOTAL_CONFLICT");assert.equal(f.writes.length,0);
});

test("Capa 2: ledger movement cannot belong to another event even with matching total COP",async()=>{
 const f=fixture();
 const foreign=[{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1",tipo:"VENTA_OFFLINE",montoCop:"3000"}];
 await assert.rejects(stage({...f,context,plan,inventoryDeltas,ledgerMovements:foreign}),
  {code:"OFFLINE_STAGING_TOTAL_CONFLICT"});
 assert.equal(f.writes.length,0);
});
test("Capa 2: ledger movement amount must match exact originating sale before any write",async()=>{
 for(const mismatch of [
  [{...ledgerMovements[0],montoCop:"2999"}],
  [{...ledgerMovements[0],montoCop:"3001"}],
  [{...ledgerMovements[0],tipo:"OTRO"}],
  [...ledgerMovements,ledgerMovements[0]],
  []
 ]){
  const f=fixture();
  await assert.rejects(stage({...f,context,plan,inventoryDeltas,ledgerMovements:mismatch}),
   {code:"OFFLINE_STAGING_TOTAL_CONFLICT"});
  assert.equal(f.writes.length,0);
 }
});

test("Capa 2: incorrect inventory product or quantity rejects the batch before any journal write",async()=>{
 for(const forged of [
  [{productoId:"507f1f77bcf86cd799439012",deltaUnidades:"-1"}],
  [{productoId:p,deltaUnidades:"-2"}],
  [{productoId:p,deltaUnidades:"-1"},{productoId:p,deltaUnidades:"-1"}],
  [{productoId:p,deltaUnidades:"-1"},{productoId:"507f1f77bcf86cd799439012",deltaUnidades:"-1"}],
  [],null
 ]){
  const f=fixture();
  await assert.rejects(stage({...f,context,plan,inventoryDeltas:forged,ledgerMovements}),
   {code:"OFFLINE_STAGING_TOTAL_CONFLICT"});
  assert.deepEqual(f.writes,[]);
 }
});
