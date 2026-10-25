"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {recoverOfflineStagedBatch:recover}=require("../../core/offline/offlineStageRecovery.service");

test("Capa 2 Mongo real: una escritura concurrente no mezcla los siete diarios de recuperación",{
 skip:!process.env.GRUK_TEST_MONGO_URI,timeout:90000
},async()=>{
 const {MongoClient}=require("mongodb");
 const client=new MongoClient(process.env.GRUK_TEST_MONGO_URI,{serverSelectionTimeoutMS:10000});
 const name="gruk_recovery_snapshot_"+randomUUID().replace(/-/g,"");
 const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"cajeroA"};
 const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
 const base={...context,eventId};
 let connected=false;
 try{
  await client.connect();connected=true;
  const db=client.db(name);
  const collections={
   gruk_offline_inbox:{...base,status:"EN_REVISION",inventoryApplied:true,
    financialStageStatus:"PENDIENTE_CONTABILIZACION",stagedBy:context.actorId},
   gruk_offline_ventas:{...base,status:"PENDIENTE_CONTABILIZACION",totalCop:"3000"},
   gruk_offline_caja_intenciones:{...base,status:"PENDIENTE_CONCILIACION",cobrado:false,montoCop:"3000"},
   gruk_ledger_movimientos:{...base,tipo:"VENTA_OFFLINE",deletedAt:null,montoCop:"3000"}
  };
  for(const [collection,doc] of Object.entries(collections))
   await db.collection(collection).insertOne(doc);
  let mutated=false,reads=0;
  const scoped={
   client,
   collection(name){
    const real=db.collection(name);
    return {find(query,options){
     assert.equal(options?.session?.inTransaction(),true);
     const cursor=real.find(query,options);
     return {async toArray(){
      const rows=await cursor.toArray();
      reads++;
      // Reconciliation reads all four collections first. Mutate after the
      // ledger read but before recovery re-reads inbox, sales and cash.
      if(name==="gruk_ledger_movimientos"&&!mutated){
       mutated=true;
       await db.collection("gruk_offline_ventas").updateOne(base,{$set:{totalCop:"9000"}});
       await db.collection("gruk_offline_caja_intenciones").updateOne(base,{$set:{montoCop:"9000"}});
      }
      return rows;
     }};
    }};
   }
  };
  const result=await recover({db:scoped,context,eventIds:[eventId]});
  assert.equal(mutated,true,"Debe modificar datos durante la transacción");
  assert.equal(reads,7,"Las siete consultas deben usar el snapshot común");
  assert.deepEqual(result,{status:"PENDIENTE_CONTABILIZACION",alreadyStaged:true,
   applied:false,cobrado:false,processedEvents:1,totalCop:"3000"});
  assert.equal((await db.collection("gruk_offline_ventas").findOne(base)).totalCop,"9000");
  // A NEW snapshot sees changed sales/cash but unchanged ledger and must
  // reject the now-inconsistent evidence without posting any new entry.
  await assert.rejects(recover({db:{client,collection:n=>db.collection(n)},
   context,eventIds:[eventId]}),{code:"OFFLINE_STAGE_REPLAY_REQUIRES_REVIEW"});
  for(const collection of Object.keys(collections))
   assert.equal(await db.collection(collection).countDocuments(base),1);
 }finally{
  if(connected){try{await client.db(name).dropDatabase();}finally{await client.close();}}
  else await client.close();
 }
});
