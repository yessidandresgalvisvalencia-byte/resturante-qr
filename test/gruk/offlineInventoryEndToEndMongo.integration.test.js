"use strict";
// Real MongoDB replica-set integration. Never use production MONGO_URI.
const test=require("node:test");
const assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongodb");
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {executeOfflineInventoryStagingTransaction:post}=require("../../core/offline/offlineInventoryStagingTransaction.service");

const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
const productId="507f1f77bcf86cd799439011";
const first="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const second="01ARZ3NDEKTSV4RRFFQ69G5FA1";
const third="01ARZ3NDEKTSV4RRFFQ69G5FA2";
const tables=["gruk_offline_ventas","gruk_offline_stock_movimientos","gruk_offline_caja_intenciones","gruk_ledger_movimientos"];
const objectId=value=>new ObjectId(value);
function order(eventId,quantity){
 const sum=quantity*3000;
 return {...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",
  payload:{localOrderId:eventId,items:[{productoId,cantidad:String(quantity),precioUnitarioCop:"3000",totalCop:String(sum)}],totalCop:String(sum)}};
}
async function counts(db){
 return Promise.all(tables.map(t=>db.collection(t).countDocuments({empresaId:context.empresaId,sedeId:context.sedeId})));
}
async function stock(db){
 return (await db.collection("inventarios").findOne({empresaId:objectId(context.empresaId),sedeId:objectId(context.sedeId),productoServicioId:objectId(productId)})).cantidad;
}
test("Mongo real: two offline orders, retry, and failure after stock update all reconcile atomically",{timeout:60000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("Requires isolated GRUK_TEST_MONGO_URI");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_offline_end_to_end_test");
 // The native Db does not expose client; this facade keeps the same collections.
 const scoped={client,collection:name=>db.collection(name)};
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  await db.collection("productoservicios").insertOne({_id:objectId(productId),empresaId:objectId(context.empresaId),
   sedeId:objectId(context.sedeId),activo:true});
  await db.collection("inventarios").insertOne({empresaId:objectId(context.empresaId),
   sedeId:objectId(context.sedeId),productoServicioId:objectId(productId),cantidad:5,anulado:false});
  await db.collection("gruk_offline_inbox").insertMany([order(first,1),order(second,2),order(third,1)]);
  const posted=await post({db:scoped,context,eventIds:[first,second],objectId});
  assert.equal(posted.status,"PENDIENTE_CONTABILIZACION");
  assert.equal(posted.sales.totalCop,"9000");
  assert.equal(posted.cash.totalCop,"9000");
  assert.equal(posted.ledger.totalCop,"9000");
  assert.equal(posted.inventoryApplied,true);
  assert.equal(await stock(db),2,"5 units - (1+2) = 2");
  assert.deepEqual(await counts(db),[2,1,2,2]);
  // An identical replay cannot debit the product again.
  await assert.rejects(post({db:scoped,context,eventIds:[first,second],objectId}),
   e=>e.code==="OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION");
  assert.equal(await stock(db),2);
  assert.deepEqual(await counts(db),[2,1,2,2]);
  // Inject a crash AFTER Mongo has executed the stock write in its session.
  // All new journals and the stock change must be rolled back together.
  const crashDb={client,collection(name){
   const target=db.collection(name);
   if(name!=="inventarios")return target;
   return {
    find:(...args)=>target.find(...args),
    findOne:(...args)=>target.findOne(...args),
    async updateOne(...args){
     await target.updateOne(...args);
     throw Error("SIMULATED_CRASH_AFTER_STOCK_WRITE");
    }
   };
  }};
  await assert.rejects(post({db:crashDb,context,eventIds:[third],objectId}),
   /SIMULATED_CRASH_AFTER_STOCK_WRITE/);
  assert.equal(await stock(db),2,"stock update must roll back");
  assert.deepEqual(await counts(db),[2,1,2,2],"new journals must roll back");
  const pending=await db.collection("gruk_offline_inbox").countDocuments({empresaId:context.empresaId,
   sedeId:context.sedeId,status:"PENDIENTE"});
  assert.equal(pending,3,"staging must never silently mark inbox APPLIED");
 }finally{await db.dropDatabase();await client.close();}
});
