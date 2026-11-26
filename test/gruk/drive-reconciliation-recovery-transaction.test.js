'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {recoverAtomically}=require('../../scripts/gruk/drive-reconciliation-recovery-transaction');
function fixture(fail=false){
 let state={active:true,events:[]},draft,closed=0;
 const session={async withTransaction(fn,opts){assert.equal(opts.readConcern.level,'snapshot');assert.equal(opts.writeConcern.w,'majority');draft={active:state.active,events:[...state.events]};const result=await fn();state=draft;return result;},async endSession(){closed++;}};
 const db={databaseName:'gruk_storage_catalog',collection(name){
  if(name==='reconciliation_control')return {async updateOne(q,u,o){assert.equal(o.session,session);assert.equal(q.active,true);if(!draft.active)return {acknowledged:true,modifiedCount:0};draft.active=u.$set.active;return {acknowledged:true,modifiedCount:1};}};
  assert.equal(name,'reconciliation_audit');return {async insertOne(row,o){assert.equal(o.session,session);if(fail&&row.type==='RECOVERY_COMPLETED')throw Error('synthetic failure');draft.events.push(row);return {acknowledged:true,insertedId:row._id};}};
 }};
 return {db,client:{startSession:()=>session},state:()=>state,closed:()=>closed};
}
const args={owner:'12345678-1234-4123-8123-123456789abc',startedAt:0,approval:'CONFIRM_WORKER_TERMINATED',evidenceId:'incident-123',now:()=>3600000};
test('transaction commits control and both audit events together',async()=>{
 const f=fixture();assert.deepEqual(await recoverAtomically({...f,...args}),{status:'RECOVERED',nextAt:90000000});
 assert.equal(f.state().active,false);assert.equal(f.state().events.length,2);assert.equal(f.closed(),1);
 await assert.rejects(recoverAtomically({...f,...args}),/TRANSACTION_CONFLICT/);
});
test('audit failure rolls back simulated reservation release',async()=>{
 const f=fixture(true);await assert.rejects(recoverAtomically({...f,...args}),/synthetic failure/);
 assert.deepEqual(f.state(),{active:true,events:[]});assert.equal(f.closed(),1);
});
