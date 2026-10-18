"use strict";
// MongoDB replica-set integration; strictly isolated from production data.
const test=require("node:test");
const assert=require("node:assert/strict");
const {MongoClient}=require("mongodb");
const {markOfflineApplied}=require("../../core/offline/offlineApply.service");
const tenant={empresaId:"offlineRollbackCompany",sedeId:"offlineRollbackSite",actorId:"offlineRollbackOperator",canReview:true};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const reviewToken="f63e7b65-8df4-4cb7-a4c2-37ac684e235a";
const ref={collection:"gruk_ledger_movimientos",eventId};
test("Mongo real: APPLIED rolls back after write failure and never duplicates on retry",{timeout:45000},async t=>{
 const uri=process.env.GRUK_TEST_MONGO_URI;
 if(!uri){t.skip("Requires isolated GRUK_TEST_MONGO_URI");return;}
 if(!uri.includes("gruk_offline_test"))throw Error("OFFLINE_TEST_DB_NAME_REQUIRED");
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});
 await client.connect();
 const db=client.db("gruk_offline_apply_rollback_test");
 const scoped={client,collection:name=>db.collection(name)};
 const key={empresaId:tenant.empresaId,sedeId:tenant.sedeId,eventId,actorId:tenant.actorId};
 try{
  await db.dropDatabase();
  await db.collection("gruk_offline_inbox").insertOne({
   ...key,status:"EN_REVISION",reviewToken,reviewActorId:tenant.actorId
  });
  await db.collection("gruk_ledger_movimientos").insertOne({
   ...key,tipo:"VENTA_OFFLINE",deletedAt:null,montoCop:"12000"
  });
  await db.collection("gruk_offline_ventas").insertOne({
   ...key,status:"CONTABILIZADA",totalCop:"12000"
  });
  await db.collection("gruk_offline_caja_intenciones").insertOne({
   ...key,status:"CONCILIADO",cobrado:true,montoCop:"12000"
  });
  // The throw occurs AFTER Mongo executes the inbox mutation. Transaction
  // rollback must revert the write, not leak an APPLIED state.
  const failingDb={client,collection(name){
   const target=db.collection(name);
   if(name!=="gruk_offline_inbox")return target;
   return {
    findOne:(...args)=>target.findOne(...args),
    async updateOne(...args){
     await target.updateOne(...args);
     throw Error("SIMULATED_CRASH_AFTER_APPLIED_WRITE");
    }
   };
  }};
  await assert.rejects(markOfflineApplied({
   db:failingDb,context:tenant,eventId,reviewToken,commitReference:ref
  }),/SIMULATED_CRASH_AFTER_APPLIED_WRITE/);
  assert.equal((await db.collection("gruk_offline_inbox").findOne(key)).status,"EN_REVISION");
  // A valid retry completes exactly once.
  const first=await markOfflineApplied({db:scoped,context:tenant,eventId,reviewToken,commitReference:ref});
  assert.equal(first.status,"APLICADO");
  assert.equal(await db.collection("gruk_offline_inbox").countDocuments({...key,status:"APLICADO"}),1);
  const retry=await markOfflineApplied({db:scoped,context:tenant,eventId,reviewToken,commitReference:ref});
  assert.equal(retry.status,"NO_RECLAMADO");
  assert.equal(await db.collection("gruk_ledger_movimientos").countDocuments(key),1);
  assert.equal(await db.collection("gruk_offline_ventas").countDocuments(key),1);
  assert.equal(await db.collection("gruk_offline_caja_intenciones").countDocuments(key),1);
 }finally{await db.dropDatabase();await client.close();}
});
