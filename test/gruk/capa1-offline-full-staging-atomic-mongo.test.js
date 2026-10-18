"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {acceptOfflineBatch,ensureInboxIndexes}=require("../../core/offline/offlineInbox.service");
const {executeOfflineInventoryStagingTransaction}=require("../../core/offline/offlineInventoryStagingTransaction.service");
const uri=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;

test("MongoDB real: cuatro diarios, inventario y bandeja revierten juntos; retry no duplica",{
 skip:!uri&&"Requiere MongoDB replica set aislado",timeout:45000
},async()=>{
 const {mongo}=require("mongoose");
 const client=new mongo.MongoClient(uri,{serverSelectionTimeoutMS:10000});
 const database="gruk_full_stage_atomic_"+randomUUID().replace(/-/g,"");
 const company=new mongo.ObjectId(),site=new mongo.ObjectId(),product=new mongo.ObjectId();
 const context={empresaId:company.toHexString(),sedeId:site.toHexString(),actorId:"operador-uno"};
 const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 const event={
  ...context,eventId,deviceId:"tablet-uno",tipo:"PEDIDO_REGISTRADO",
  occurredAt:"2026-10-18T12:00:00.000Z",schemaVersion:1,
  payload:{localOrderId:"01ARZ3NDEKTSV4RRFFQ69G5FA1",items:[{
   productoId:product.toHexString(),cantidad:"2",precioUnitarioCop:"3750",totalCop:"7500"
  }],totalCop:"7500"}
 };
 let connected=false;
 try{
  await client.connect();connected=true;
  const db=client.db(database);
  await ensureInboxIndexes(db);
  for(const [collection,name,keys] of [
   ["gruk_offline_ventas","uniq_offline_sale_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
   ["gruk_offline_caja_intenciones","uniq_offline_cash_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
   ["gruk_offline_stock_movimientos","uniq_offline_stock_tenant_batch_product",{empresaId:1,sedeId:1,batchId:1,productoId:1}],
   ["gruk_ledger_movimientos","uniq_offline_ledger_event_type_tenant",{empresaId:1,sedeId:1,eventId:1,tipo:1}]
  ])await db.collection(collection).createIndex(keys,{name,unique:true});
  await db.collection("productoservicios").insertOne({
   _id:product,empresaId:company,sedeId:site,activo:true,precioVenta:3750
  });
  await db.collection("inventarios").insertOne({
   empresaId:company,sedeId:site,productoServicioId:product,anulado:false,cantidad:5
  });
  assert.equal((await acceptOfflineBatch({db,authenticatedContext:context,events:[event]}))[0].status,"RECIBIDO");
  const key={empresaId:context.empresaId,sedeId:context.sedeId,eventId};
  const legacyKey={empresaId:company,sedeId:site,productoServicioId:product,anulado:false};
  const snapshot=async()=>{
   const inbox=await db.collection("gruk_offline_inbox").findOne(key);
   return {
    inbox:inbox.status,inventoryApplied:inbox.inventoryApplied??null,
    sales:await db.collection("gruk_offline_ventas").countDocuments(key),
    cash:await db.collection("gruk_offline_caja_intenciones").countDocuments(key),
    ledger:await db.collection("gruk_ledger_movimientos").countDocuments(key),
    stock:await db.collection("gruk_offline_stock_movimientos").countDocuments({
     empresaId:context.empresaId,sedeId:context.sedeId
    }),
    quantity:(await db.collection("inventarios").findOne(legacyKey)).cantidad
   };
  };
  const initial={inbox:"PENDIENTE",inventoryApplied:null,sales:0,cash:0,ledger:0,stock:0,quantity:5};
  assert.deepEqual(await snapshot(),initial);
  const execute=onStaged=>executeOfflineInventoryStagingTransaction({
   db,context,eventIds:[eventId],objectId:id=>new mongo.ObjectId(id),
   requireAuthoritativePricing:true,onStaged
  });
  await assert.rejects(execute(async result=>{
   assert.equal(result.inventory[0].antes,"5");
   assert.equal(result.inventory[0].despues,"3");
   const inbox=await db.collection("gruk_offline_inbox").findOne(key,{session:result.session});
   assert.equal(inbox.status,"EN_REVISION");
   assert.equal(inbox.inventoryApplied,true);
   throw Error("INJECTED_FAILURE_AFTER_INBOX_HANDOFF");
  }),/INJECTED_FAILURE_AFTER_INBOX_HANDOFF/);
  assert.deepEqual(await snapshot(),initial,
   "No deben sobrevivir diarios, stock ni cambios de bandeja después de rollback");
  const posted=await execute(null);
  assert.equal(posted.inventoryApplied,true);
  assert.equal(posted.handoffs.length,1);
  assert.equal(posted.sales.totalCop,"7500");
  assert.deepEqual(await snapshot(),{
   inbox:"EN_REVISION",inventoryApplied:true,sales:1,cash:1,ledger:1,stock:1,quantity:3
  });
  const cash=await db.collection("gruk_offline_caja_intenciones").findOne(key);
  assert.equal(cash.cobrado,false);
  await assert.rejects(execute(null),error=>error?.code==="OFFLINE_ORDERS_NOT_PENDING");
  assert.deepEqual(await snapshot(),{
   inbox:"EN_REVISION",inventoryApplied:true,sales:1,cash:1,ledger:1,stock:1,quantity:3
  });
 }finally{
  if(connected){try{await client.db(database).dropDatabase();}finally{await client.close();}}
  else await client.close();
 }
});
