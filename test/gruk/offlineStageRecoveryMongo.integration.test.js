"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoClient,ObjectId}=require("mongodb");
const {bootstrapOfflineStagingIndexes}=require("../../core/offline/offlineIndexesBootstrap.service");
const {stageAuthorizedOfflineOrders}=require("../../core/offline/offlineAdminStage.service");
const {executeOfflineInventoryStagingTransaction}=require("../../core/offline/offlineInventoryStagingTransaction.service");
const auth={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",
 usuarioId:"adminA",rol:"ADMIN_SEDE"};
const productId="507f1f77bcf86cd799439011";
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
const objectId=value=>new ObjectId(value);
test("real Mongo: 503, interrupted writes and lost HTTP ack replay without duplicate stock or charge",{timeout:60000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("Isolated GRUK_TEST_MONGO_URI required");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_offline_stage_replay_test");
 const scoped={client,collection:name=>db.collection(name)};
 const inventoryKey={empresaId:objectId(auth.empresaId),sedeId:objectId(auth.sedeId),
  productoServicioId:objectId(productId)};
 const args={db:scoped,auth,eventIds:ids,confirmed:true};
 try{
  await db.dropDatabase();
  await bootstrapOfflineStagingIndexes(db);
  await db.collection("productoservicios").insertOne({
   _id:objectId(productId),empresaId:objectId(auth.empresaId),sedeId:objectId(auth.sedeId),
   activo:true,precioVenta:3000
  });
  await db.collection("inventarios").insertOne({...inventoryKey,cantidad:5,anulado:false});
  await db.collection("gruk_offline_inbox").insertMany(ids.map((eventId,i)=>({
   empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:auth.usuarioId,
   eventId,status:"PENDIENTE",tipo:"PEDIDO_REGISTRADO",payload:{
    localOrderId:eventId,items:[{productoId:productId,cantidad:String(i+1),
     precioUnitarioCop:"3000",totalCop:String((i+1)*3000)}],totalCop:String((i+1)*3000)
   }
  })));
  // Simulate missing transaction support while Mongo data itself remains intact.
  // The HTTP /stage-orders handler maps this domain error to retryable 503.
  const unavailable={...args,db:{collection:name=>db.collection(name)}};
  await assert.rejects(stageAuthorizedOfflineOrders(unavailable),
   {code:"OFFLINE_TRANSACTION_UNAVAILABLE"});
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
   empresaId:auth.empresaId,sedeId:auth.sedeId,status:"PENDIENTE"
  }),2,"An unavailable transaction must not consume pending events");
  assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,5);
  for(const name of ["gruk_offline_ventas","gruk_offline_caja_intenciones",
   "gruk_ledger_movimientos"])
   assert.equal(await db.collection(name).countDocuments({}),0,name+" cannot post on a 503");
  // The failure is injected AFTER the four journals, inventory debit and
  // inbox handoff were acknowledged inside the transaction, before commit.
  // Three repeated interruptions must leave absolutely no partial posting.
  for(let attempt=0;attempt<3;attempt++){
   let stagedHookCalls=0;
   await assert.rejects(executeOfflineInventoryStagingTransaction({
    db:scoped,context:{empresaId:auth.empresaId,sedeId:auth.sedeId,
     actorId:auth.usuarioId},eventIds:ids,objectId,requireAuthoritativePricing:true,
    onStaged:async()=>{
     stagedHookCalls++;
     throw Error("INJECTED_INTERRUPTION_AFTER_ALL_WRITES");
    }
   }),/INJECTED_INTERRUPTION_AFTER_ALL_WRITES/);
   assert.equal(stagedHookCalls,1,"Failure must run after the journal and stock writes");
   assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,5);
   for(const collection of ["gruk_offline_ventas","gruk_offline_stock_movimientos",
    "gruk_offline_caja_intenciones","gruk_ledger_movimientos"])
    assert.equal(await db.collection(collection).countDocuments({}),0,
     collection+" must roll back on interruption "+attempt);
   assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
    empresaId:auth.empresaId,sedeId:auth.sedeId,status:"PENDIENTE"
   }),2,"The two original inbox orders must remain retryable");
  }
  // Simulate a lost TCP/HTTP acknowledgement AFTER the server has committed.
  // The client never receives the success body and retries its original ULIDs.
  let committedButUnacknowledged=false;
  await assert.rejects(async()=>{
   const internal=await stageAuthorizedOfflineOrders(args);
   assert.equal(internal.status,"PENDIENTE_CONTABILIZACION");
   assert.equal(internal.applied,false);assert.equal(internal.cobrado,false);
   assert.equal(internal.totalCop,"9000");
   committedButUnacknowledged=true;
   throw new Error("SIMULATED_LOST_HTTP_RESPONSE_AFTER_COMMIT");
  },/SIMULATED_LOST_HTTP_RESPONSE_AFTER_COMMIT/);
  assert.equal(committedButUnacknowledged,true);
  assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,2);
  for(const [collection,expected] of [
   ["gruk_offline_ventas",2],
   ["gruk_offline_stock_movimientos",1], // aggregated per product per batch
   ["gruk_offline_caja_intenciones",2],
   ["gruk_ledger_movimientos",2]
  ])assert.equal(await db.collection(collection).countDocuments({}),expected,
   collection+" must be committed once before a response reaches client");
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
   empresaId:auth.empresaId,sedeId:auth.sedeId,status:"EN_REVISION",inventoryApplied:true
  }),2);
  // The first client-visible reply is from the replay: it must identify
  // already-staged events without a second financial write or stock debit.
  for(let attempt=0;attempt<5;attempt++){
   const second=await stageAuthorizedOfflineOrders(args);
   assert.equal(second.alreadyStaged,true,"Replay "+attempt+" must be idempotent");
   assert.equal(second.status,"PENDIENTE_CONTABILIZACION");
   assert.equal(second.applied,false);assert.equal(second.cobrado,false);
   assert.equal(second.totalCop,"9000");
   assert.equal((await db.collection("inventarios").findOne(inventoryKey)).cantidad,2);
  }
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
   empresaId:auth.empresaId,sedeId:auth.sedeId,status:"EN_REVISION",inventoryApplied:true
  }),2);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({}),2);
  assert.equal(await db.collection("gruk_offline_caja_intenciones").countDocuments({cobrado:true}),0);
  assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments({}),2);
  assert.equal(await db.collection("gruk_offline_caja_intenciones").countDocuments({}),2);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments({
   empresaId:auth.empresaId,sedeId:auth.sedeId,actorId:auth.usuarioId
  }),2);
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({
   empresaId:auth.empresaId,sedeId:auth.sedeId,status:"PENDIENTE"
  }),0);
 }finally{await db.dropDatabase();await client.close();}
});
