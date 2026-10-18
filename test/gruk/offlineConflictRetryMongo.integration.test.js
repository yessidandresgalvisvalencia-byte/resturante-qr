"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongodb");
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {stageAuthorizedOfflineOrders}=require("../../core/offline/offlineAdminStage.service");
const {retryOfflineConflict}=require("../../core/offline/offlineConflictRetry.service");
const company="507f191e810c19729de860ea",site="507f1f77bcf86cd799439012",
 product="507f1f77bcf86cd799439011",eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const staff={empresaId:company,sedeId:site,usuarioId:"worker",rol:"ADMIN_SEDE"},
 supervisor={...staff,usuarioId:"supervisor"};
const oid=x=>new ObjectId(x);
test("real Mongo: supervised retry is atomic, authorized and idempotent after restock",{timeout:60000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("Requires isolated Mongo replica set");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_offline_conflict_retry_atomic_test");
 const wrapped={client,collection:n=>db.collection(n)};
 const inventoryKey={empresaId:oid(company),sedeId:oid(site),productoServicioId:oid(product),anulado:false};
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  await db.collection("productoservicios").insertOne({
   _id:oid(product),empresaId:oid(company),sedeId:oid(site),activo:true,precioVenta:3000
  });
  await db.collection("inventarios").insertOne({...inventoryKey,cantidad:0});
  await db.collection("gruk_offline_inbox").insertOne({
   empresaId:company,sedeId:site,actorId:"worker",eventId,tipo:"PEDIDO_REGISTRADO",
   status:"PENDIENTE",payload:{localOrderId:eventId,
    items:[{productoId:product,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"}
  });
  const conflict=await stageAuthorizedOfflineOrders({db:wrapped,auth:staff,eventIds:[eventId],confirmed:true});
  assert.equal(conflict.status,"REQUIERE_REVISION_STOCK");
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({}),0);
  await db.collection("inventarios").updateOne(inventoryKey,{$set:{cantidad:1}});
  const request={db:wrapped,auth:supervisor,conflictId:conflict.conflictId,confirmed:true,
   note:"Pedido conservado y reabastecimiento confirmado"};
  const failedWrapper={client,collection(name){
   const collection=db.collection(name);
   if(name!=="gruk_offline_stock_resolutions")return collection;
   return {
    findOne:(...args)=>collection.findOne(...args),
    async insertOne(){throw Error("SIMULATED_RESOLUTION_WRITE_CRASH");}
   };
  }};
  await assert.rejects(retryOfflineConflict({...request,db:failedWrapper}),
   /SIMULATED_RESOLUTION_WRITE_CRASH/);
  assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,1,
   "failed resolution write must rollback stock");
  for(const collection of ["gruk_offline_ventas","gruk_offline_caja_intenciones","gruk_ledger_movimientos",
   "gruk_offline_stock_resolutions"]){
   assert.equal(await db.collection(collection).countDocuments({}),0,"no partial "+collection);
  }
  assert.equal((await db.collection("gruk_offline_inbox").findOne({eventId})).status,"PENDIENTE");
  const result=await retryOfflineConflict(request);
  assert.equal(result.status,"STAGED");
  assert.equal(result.alreadyResolved,false);
  assert.equal(result.applied,false);assert.equal(result.cobrado,false);
  assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,0);
  assert.equal(await db.collection("gruk_offline_stock_resolutions").countDocuments({}),1);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({}),1);
  assert.equal(await db.collection("gruk_offline_caja_intenciones").countDocuments({cobrado:true}),0);
  assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments({}),1);
  const repeat=await retryOfflineConflict(request);
  assert.equal(repeat.alreadyResolved,true);assert.equal(repeat.applied,false);
  assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,0);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({}),1);
  assert.equal(await db.collection("gruk_offline_stock_resolutions").countDocuments({}),1);
  const denied={...supervisor,sedeId:"507f1f77bcf86cd799439013"};
  await assert.rejects(retryOfflineConflict({...request,auth:denied}),e=>e.code==="OFFLINE_CONFLICT_NOT_FOUND");
 }finally{await db.dropDatabase();await client.close();}
});
