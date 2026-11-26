'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRuntime}=require('../../scripts/gruk/native-storage-runtime');
test('runtime launches only local service and keeps real backups blocked',async()=>{
 let launches=0,executions=0;
 const env={GRUK_NATIVE_BACKUP_ROOT:'/synthetic/vault'};
 const launch=async()=>{launches++;};
 const execute=()=>{executions++;};
 assert.throws(()=>createRuntime({env:{...env,GRUK_NATIVE_REAL_BACKUP_ENABLED:'true'},launch,execute}),/REAL_BACKUP_RELEASE_BLOCKED/);
 assert.throws(()=>createRuntime({env:{},launch,execute}),/INVALID_CONFIG/);
 const runtime=createRuntime({env,launch,execute});
 await runtime.start();
 assert.equal(launches,1);
 assert.equal(executions,0);
 assert.deepEqual(runtime.status(),{realBackupEnabled:false,scheduler:{busy:false,lastSuccess:null,lastFailure:null,running:false}});
});
