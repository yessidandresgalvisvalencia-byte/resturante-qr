"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongoose").mongo;
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {stageOfflineFinancialBatch}=require("../../core/offline/offlineFinancialStaging.service");
const {applyOfflineLegacyInventory}=require("../../core/offline/offlineLegacyInventoryWriter.service");
const empresaId="507f191e810c19729de860ea",sedeId="507f1f77bcf86cd799439012";
const productoId="507f1f77bcf86cd799439011",eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const context={empresaId,sedeId,actorId:"cajero"};
const plan={orders:[{eventId,localOrderId:eventId,totalCop:"3000",items:[{productoId,cantidad:"2",precioUnitarioCop:"1500",totalCop:"3000"}]}],totalCop:"3000"};
const inventoryDeltas=[{productoId,deltaUnidades:"-2"}];
const ledgerMovements=[{eventId,tipo:"VENTA_OFFLINE",montoCop:"3000"}];
const stagedNames=["gruk_offline_ventas","gruk_offline_stock_movimientos","gruk_offline_caja_intenciones","gruk_ledger_movimientos"];
test("Mongo real: four financial journals and actual stock commit or rollback together",{timeout:30000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("GRUK_TEST_MONGO_URI missing");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_URI_NOT_ISOLATED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000}),db=client.db("gruk_five_way_atomic_test");
 await client.connect();
 const stockKey={empresaId:new ObjectId(empresaId),sedeId:new ObjectId(sedeId),
   productoServicioId:new ObjectId(productoId),anulado:false};
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  await db.collection("inventarios").insertOne({...stockKey,cantidad:4});
  async function post(delta){
   const session=client.startSession();
   try{
    return await session.withTransaction(async()=>{
     const staged=await stageOfflineFinancialBatch({db,session,context,plan,inventoryDeltas,ledgerMovements});
     const inventory=await applyOfflineLegacyInventory({
      db,session,context,inventoryDeltas:[{productoId,deltaUnidades:delta}],
      objectId:x=>new ObjectId(x)
     });
     return {staged,inventory};
    });
   }finally{await session.endSession();}
  }
  // Force failure in the last operation; all four earlier journal inserts must roll back.
  await assert.rejects(post("-5"),e=>e.code==="OFFLINE_INVENTORY_INSUFFICIENT");
  for(const name of stagedNames)assert.equal(await db.collection(name).countDocuments({}),0,name);
  assert.equal((await db.collection("inventarios").findOne(stockKey)).cantidad,4);
  const result=await post("-2");
  assert.equal(result.staged.sales.totalCop,"3000");
  assert.equal(result.inventory[0].despues,"2");
  for(const name of stagedNames)assert.equal(await db.collection(name).countDocuments({}),1,name);
  assert.equal((await db.collection("inventarios").findOne(stockKey)).cantidad,2);
 }finally{await db.dropDatabase();await client.close();}
});
