"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongodb");
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {executeOfflineInventoryStagingTransaction}=require("../../core/offline/offlineInventoryStagingTransaction.service");
const tenant={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
const productId="507f1f77bcf86cd799439011";
const asObjectId=x=>new ObjectId(x);
const ids=Array.from({length:20},(_,i)=>"01ARZ3NDEKTSV4RRFFQ69G"+String(i).padStart(4,"0"));
const tables=["gruk_offline_ventas","gruk_offline_stock_movimientos","gruk_offline_caja_intenciones","gruk_ledger_movimientos"];
function order(eventId,i){
 const quantity=i%2===0?1:2;
 return {...tenant,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",deviceId:i%2===0?"tabletA":"tabletB",
  payload:{localOrderId:eventId,items:[{productoId:productId,cantidad:String(quantity),precioUnitarioCop:"3000",totalCop:String(quantity*3000)}],
   totalCop:String(quantity*3000)}};
}
async function inventory(db){
 const row=await db.collection("inventarios").findOne({
  empresaId:asObjectId(tenant.empresaId),sedeId:asObjectId(tenant.sedeId),productoServicioId:asObjectId(productId)
 });
 return row?.cantidad;
}
test("20 offline orders across two tablets: Mongo financial journals, exact COP, stock and replay",{timeout:60000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("Mongo replica set required");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_offline_financial_20_test");
 const scoped={client,collection:name=>db.collection(name)};
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  await db.collection("productoservicios").insertOne({
   _id:asObjectId(productId),empresaId:asObjectId(tenant.empresaId),sedeId:asObjectId(tenant.sedeId),activo:true
  });
  await db.collection("inventarios").insertOne({
   empresaId:asObjectId(tenant.empresaId),sedeId:asObjectId(tenant.sedeId),
   productoServicioId:asObjectId(productId),cantidad:40,anulado:false
  });
  await db.collection("gruk_offline_inbox").insertMany(ids.map(order));
  const outcome=await executeOfflineInventoryStagingTransaction({
   db:scoped,context:tenant,eventIds:ids,objectId:asObjectId
  });
  assert.equal(outcome.status,"PENDIENTE_CONTABILIZACION");
  assert.equal(outcome.inventoryApplied,true);
  assert.equal(outcome.sales.totalCop,"90000");
  assert.equal(outcome.cash.totalCop,"90000");
  assert.equal(outcome.ledger.totalCop,"90000");
  assert.equal(outcome.stock.records.length,1);
  assert.equal(outcome.inventory[0].antes,"40");
  assert.equal(outcome.inventory[0].despues,"10");
  assert.equal(await inventory(db),10);
  for(const [index,name] of tables.entries()){
   assert.equal(await db.collection(name).countDocuments({
    empresaId:tenant.empresaId,sedeId:tenant.sedeId
   }),index===1?1:20,name);
  }
  assert.equal(await db.collection("gruk_offline_caja_intenciones").countDocuments({cobrado:true}),0,
   "staging must not claim cash captured");
  // Replaying the same batch cannot create sales or debit the legacy inventory twice.
  await assert.rejects(executeOfflineInventoryStagingTransaction({
   db:scoped,context:tenant,eventIds:ids,objectId:asObjectId
  }),e=>e.code==="OFFLINE_ORDERS_NOT_PENDING");
  assert.equal(await inventory(db),10);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({}),20);
  assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments({}),20);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({status:"EN_REVISION",inventoryApplied:true}),20,
   "each staged event must be in review, not APPLIED");
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({status:"APLICADO"}),0);
 }finally{await db.dropDatabase();await client.close();}
});
