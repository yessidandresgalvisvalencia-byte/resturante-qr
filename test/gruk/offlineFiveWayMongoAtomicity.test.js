"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongoose").mongo;
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {stageOfflineFinancialBatch}=require("../../core/offline/offlineFinancialStaging.service");
const {applyOfflineLegacyInventory}=require("../../core/offline/offlineLegacyInventoryWriter.service");
const empresaId="507f191e810c19729de860ea",sedeId="507f1f77bcf86cd799439012",productoId="507f1f77bcf86cd799439011";
const context={empresaId,sedeId,actorId:"cajero"},eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const plan={orders:[{eventId,localOrderId:eventId,totalCop:"3000",items:[{productoId,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}]}],totalCop:"3000"};
const inventoryDeltas=[{productoId,deltaUnidades:"-1"}];
const ledgerMovements=[{eventId,tipo:"VENTA_OFFLINE",montoCop:"3000"}];
const journals=["gruk_offline_ventas","gruk_offline_stock_movimientos","gruk_offline_caja_intenciones","gruk_ledger_movimientos"];
test("Mongo replica set: four offline journals plus real inventory commit and rollback together",{timeout:30000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("GRUK_TEST_MONGO_URI no configurado");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 const db=client.db("gruk_five_way_atomicity_test");await client.connect();
 const oid=x=>new ObjectId(x);
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  await db.collection("inventarios").insertOne({empresaId:oid(empresaId),sedeId:oid(sedeId),productoServicioId:oid(productoId),anulado:false,cantidad:2});
  const perform=async session=>{
   await stageOfflineFinancialBatch({db,session,context,plan,inventoryDeltas,ledgerMovements});
   return applyOfflineLegacyInventory({db,session,context,inventoryDeltas,objectId:oid});
  };
  let session=client.startSession();
  try{await session.withTransaction(async()=>{const out=await perform(session);assert.equal(out[0].despues,"1");});}
  finally{await session.endSession();}
  for(const name of journals)assert.equal(await db.collection(name).countDocuments({}),1,name);
  assert.equal((await db.collection("inventarios").findOne({productoServicioId:oid(productoId)})).cantidad,1);
  // Simulate downstream failure during replay; no second stock decrement may persist.
  session=client.startSession();
  try{await assert.rejects(session.withTransaction(async()=>{await perform(session);throw Error("SIMULATED_DOWNSTREAM_FAILURE");}),/SIMULATED_DOWNSTREAM_FAILURE/);}
  finally{await session.endSession();}
  for(const name of journals)assert.equal(await db.collection(name).countDocuments({}),1,name);
  assert.equal((await db.collection("inventarios").findOne({productoServicioId:oid(productoId)})).cantidad,1);
 }finally{await db.dropDatabase();await client.close();}
});
