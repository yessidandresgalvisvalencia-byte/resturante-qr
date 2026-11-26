'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {probeWrite}=require('../../scripts/gruk/native-storage-mongo-vault-write-probe');
const host='vault.example.mongodb.net';
const env={GRUK_VAULT_WRITE_PROBE_ENABLED:'true',GRUK_NATIVE_REAL_BACKUP_ENABLED:'false',GRUK_VAULT_EXPECTED_HOST:host,GRUK_VAULT_MONGO_URI:'mongodb+srv://gruk_vault_worker:fake@'+host+'/gruk_storage_vault'};
test('probe gated, aborts and closes, never commits',async()=>{
 await assert.rejects(probeWrite({env:{...env,GRUK_NATIVE_REAL_BACKUP_ENABLED:'true'},connect:async()=>assert.fail()}),/DISABLED/);
 let used=0,aborted=false,closed=false,ended=false;
 const records=new Map();
 const session={startTransaction(){},async abortTransaction(){aborted=true;used=0;records.clear();},async endSession(){ended=true;},commitTransaction(){assert.fail('commit forbidden');}};
 const c={db:{databaseName:'gruk_storage_vault',collection(n){return n==='vault_quota'?{findOne:async()=>({used}),updateOne:async()=>{used++;return {modifiedCount:1};}}:{insertOne:async(d,o)=>{assert.equal(o.session,session);records.set(n+d._id,d);},findOne:async(q)=>records.get(n+q._id)||null};}},getClient:()=>({startSession:()=>session}),close:async()=>{closed=true;}};
 const result=await probeWrite({env,connect:async()=>c});
 assert.equal(result.status,'SYNTHETIC_WRITE_ABORT_VERIFIED');assert.ok(aborted&&closed&&ended);assert.equal(used,0);
});
