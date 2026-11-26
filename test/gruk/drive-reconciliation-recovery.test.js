'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {recoverInterrupted}=require('../../scripts/gruk/drive-reconciliation-coordinator');
test('manual recovery requires exact owner, evidence, cooldown and explicit confirmation',async()=>{
 const owner='12345678-1234-4123-8123-123456789abc',startedAt=0;
 let calls=0;const db={databaseName:'gruk_storage_catalog',collection(name){
  assert.equal(name,'reconciliation_control');
  return {async updateOne(q,u,o){calls++;assert.deepEqual(q,{_id:'enterprise-reconciliation',active:true,owner,startedAt});assert.equal(u.$set.lastRecovery.evidenceId,'incident-123');assert.equal(u.$set.active,false);assert.equal(o.writeConcern.w,'majority');return {acknowledged:true,modifiedCount:1};}};
 }};
 const args={owner,startedAt,approval:'CONFIRM_WORKER_TERMINATED',evidenceId:'incident-123',now:()=>3600000};
 await assert.rejects(recoverInterrupted(db,{...args,approval:'no'}),/RECOVERY_CONFIG/);
 await assert.rejects(recoverInterrupted(db,{...args,now:()=>10}),/RECOVERY_TOO_EARLY/);
 assert.equal(calls,0);
 assert.deepEqual(await recoverInterrupted(db,args),{status:'RECOVERED',nextAt:90000000});
 assert.equal(calls,1);
 const stale={databaseName:'gruk_storage_catalog',collection(){return {async updateOne(){return {acknowledged:true,modifiedCount:0};}};}};
 await assert.rejects(recoverInterrupted(stale,args),/RECOVERY_UNCONFIRMED/);
});
