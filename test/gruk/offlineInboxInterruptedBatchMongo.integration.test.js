"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MongoClient}=require("mongodb");
const {randomUUID}=require("node:crypto");
const {acceptOfflineBatch,ensureInboxIndexes}=require("../../core/offline/offlineInbox.service");

test("Capa 2 Mongo real: interrumpir recepción del lote y perder su ACK nunca duplica eventos",{
 skip:!process.env.GRUK_TEST_MONGO_URI,timeout:90000
},async()=>{
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI,{serverSelectionTimeoutMS:10000});
 const name="gruk_inbox_retry_"+randomUUID().replace(/-/g,"");
 const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"cajeroA"};
 const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
 const events=ids.map((eventId,i)=>({
  eventId,...context,deviceId:"tablet1",tipo:"PEDIDO_REGISTRADO",
  occurredAt:"2026-10-25T10:00:00.000Z",schemaVersion:1,
  payload:{localOrderId:eventId,totalCop:String((i+1)*3000)}
 }));
 let connected=false;
 try{
  await client.connect();connected=true;
  const db=client.db(name),inbox=db.collection("gruk_offline_inbox");
  await ensureInboxIndexes(db);
  const scoped={client,collection:n=>db.collection(n)};
  let writes=0;
  const interrupted={client,collection(n){
   const collection=db.collection(n);
   if(n!=="gruk_offline_inbox")return collection;
   return {findOne:(...args)=>collection.findOne(...args),
    updateOne:async(...args)=>{
     const result=await collection.updateOne(...args);
     if(++writes===1)throw Error("SIMULATED_CONNECTION_LOSS_DURING_BATCH");
     return result;
    }};
  }};
  await assert.rejects(acceptOfflineBatch({db:interrupted,
   authenticatedContext:context,events}),/SIMULATED_CONNECTION_LOSS_DURING_BATCH/);
  assert.equal(writes,1);
  assert.equal(await inbox.countDocuments({}),0,
   "Mongo transaction must roll back first accepted event when second never arrives");
  // Retry the exact same ULIDs after interruption; the first committed reply
  // is deliberately lost after Mongo has persisted the entire batch.
  let committed=false;
  await assert.rejects(async()=>{
   const accepted=await acceptOfflineBatch({db:scoped,authenticatedContext:context,events});
   assert.deepEqual(accepted.map(x=>x.status),["RECIBIDO","RECIBIDO"]);
   committed=true;
   throw Error("SIMULATED_HTTP_ACK_LOST_AFTER_COMMIT");
  },/SIMULATED_HTTP_ACK_LOST_AFTER_COMMIT/);
  assert.equal(committed,true);
  assert.equal(await inbox.countDocuments({}),2);
  for(let attempt=0;attempt<5;attempt++){
   const replay=await acceptOfflineBatch({db:scoped,authenticatedContext:context,events});
   assert.deepEqual(replay.map(x=>x.status),["YA_RECIBIDO","YA_RECIBIDO"]);
   assert.equal(await inbox.countDocuments({}),2);
   assert.equal(await inbox.countDocuments({status:"PENDIENTE"}),2);
  }
  const foreign={...context,empresaId:"empresaB"};
  await assert.rejects(acceptOfflineBatch({db:scoped,authenticatedContext:foreign,events}),
   {code:"OFFLINE_TENANT_MISMATCH"});
  assert.equal(await inbox.countDocuments({}),2);
  for(const n of ["gruk_offline_ventas","gruk_offline_caja_intenciones",
   "gruk_ledger_movimientos","gruk_offline_stock_movimientos"])
   assert.equal(await db.collection(n).countDocuments({}),0,
    "Inbox acceptance must never post financial or inventory journals");
 }finally{
  if(connected){try{await client.db(name).dropDatabase();}finally{await client.close();}}
  else await client.close();
 }
});
