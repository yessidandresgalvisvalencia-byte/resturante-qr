'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createCoordinator}=require('./drive-reconciliation-coordinator');
const {recoverAtomically}=require('./drive-reconciliation-recovery-transaction');
async function main(){
 // Hardcoded loopback only. Never accept a URI or production credentials.
 const c=require('mongoose').createConnection('mongodb://127.0.0.1:27189/gruk_storage_catalog?replicaSet=grukci&directConnection=true',{serverSelectionTimeoutMS:15000});
 try{
  await c.asPromise();
  const db=c.db,client=c.getClient();
  const hello=await db.admin().command({hello:1});
  assert.equal(hello.setName,'grukci');
  assert.equal(hello.isWritablePrimary,true);
  const control=db.collection('reconciliation_control'),audit=db.collection('reconciliation_audit');
  await db.createCollection('reconciliation_control');
  await db.createCollection('reconciliation_audit');
  const now=()=>0;
  let count=0;
  const runs=await Promise.all(Array.from({length:8},()=>createCoordinator(db,{now})(async()=>{count++;return 'done';})));
  assert.equal(count,1);
  assert.equal(runs.filter(x=>x==='done').length,1);
  assert.equal(runs.filter(x=>x?.status==='SKIPPED').length,7);
  const owner='12345678-1234-4123-8123-123456789abc',startedAt=0;
  await control.updateOne({_id:'enterprise-reconciliation'},{$set:{active:true,owner,startedAt}});
  const duplicate=createHash('sha256').update(JSON.stringify([owner,'RECOVERY_COMPLETED'])).digest('hex');
  await audit.insertOne({_id:duplicate,synthetic:true});
  const args={client,db,owner,startedAt,approval:'CONFIRM_WORKER_TERMINATED',evidenceId:'synthetic-incident',now:()=>3600000};
  await assert.rejects(recoverAtomically(args),e=>e?.code===11000);
  assert.equal((await control.findOne({_id:'enterprise-reconciliation'})).active,true);
  assert.equal(await audit.countDocuments({}),1);
  await audit.deleteOne({_id:duplicate});
  assert.equal((await recoverAtomically(args)).status,'RECOVERED');
  assert.equal((await control.findOne({_id:'enterprise-reconciliation'})).active,false);
  assert.equal(await audit.countDocuments({}),2);
  console.log('GRUK_CATALOG_REAL_REPLICA_SYNTHETIC_OK');
 }finally{await c.close();}
}
main().catch(()=>{console.error('GRUK_CATALOG_REAL_REPLICA_SYNTHETIC_FAILED');process.exitCode=1;});
