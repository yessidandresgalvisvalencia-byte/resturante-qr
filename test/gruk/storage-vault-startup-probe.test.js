'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runStartupVaultProbe}=require('../../core/health/storageVaultProbe.service');
test('startup vault probe disabled by default and blocked for real backups',async()=>{
 const logs=[];
 await runStartupVaultProbe({env:{},open:()=>assert.fail(),log:x=>logs.push(x)});
 assert.deepEqual(logs,[]);
 await runStartupVaultProbe({env:{GRUK_VAULT_STARTUP_PROBE:'true',GRUK_NATIVE_REAL_BACKUP_ENABLED:'true'},open:()=>assert.fail(),log:x=>logs.push(x)});
 assert.deepEqual(logs,['GRUK_VAULT_STARTUP_BLOCKED']);
});
test('startup probe uses separate read-only connection and redacts failure',async()=>{
 const host='vault.example.mongodb.net',logs=[];
 const env={GRUK_VAULT_STARTUP_PROBE:'true',GRUK_VAULT_EXPECTED_HOST:host,GRUK_VAULT_MONGO_URI:'mongodb+srv://gruk_vault_worker:fake@'+host+'/gruk_storage_vault'};
 let closed=false;
 await runStartupVaultProbe({env,log:x=>logs.push(x),open:async(uri,opts)=>{assert.equal(opts.dbName,'gruk_storage_vault');assert.equal(opts.tls,true);return {db:{databaseName:'gruk_storage_vault',collection(n){return {findOne:async()=>n==='vault_quota'?{used:0}:null};}},close:async()=>{closed=true;}};}});
 assert.equal(closed,true);assert.deepEqual(logs,['GRUK_VAULT_STARTUP_READ_ACCESS_VERIFIED']);
 await runStartupVaultProbe({env,log:x=>logs.push(x),open:async()=>{throw Error('secret URI');}});
 assert.equal(logs.at(-1),'GRUK_VAULT_STARTUP_FAILED VAULT_UNCLASSIFIED');
});

test('startup write probe requires separate explicit flag and successful read',async()=>{
 const host='vault.example.mongodb.net',logs=[];
 const env={GRUK_VAULT_STARTUP_PROBE:'true',GRUK_VAULT_EXPECTED_HOST:host,GRUK_VAULT_MONGO_URI:'mongodb+srv://gruk_vault_worker:fake@'+host+'/gruk_storage_vault'};
 const open=async()=>({db:{databaseName:'gruk_storage_vault',collection(n){return {findOne:async()=>n==='vault_quota'?{used:0}:null};}},close:async()=>{}});
 let calls=0;
 const write=async({env:e})=>{calls++;assert.equal(e.GRUK_NATIVE_REAL_BACKUP_ENABLED,'false');assert.equal(e.GRUK_VAULT_WRITE_PROBE_ENABLED,'true');return {status:'SYNTHETIC_WRITE_ABORT_VERIFIED'};};
 await runStartupVaultProbe({env,open,write,log:x=>logs.push(x)});
 assert.equal(calls,0);
 await runStartupVaultProbe({env:{...env,GRUK_VAULT_STARTUP_WRITE_PROBE:'true'},open,write,log:x=>logs.push(x)});
 assert.equal(calls,1);assert.equal(logs.at(-1),'GRUK_VAULT_STARTUP_WRITE_ABORT_VERIFIED');
 await runStartupVaultProbe({env:{...env,GRUK_VAULT_STARTUP_WRITE_PROBE:'true'},open:async()=>{throw Error('secret');},write,log:x=>logs.push(x)});
 assert.equal(calls,1);
 await runStartupVaultProbe({env:{...env,GRUK_VAULT_STARTUP_WRITE_PROBE:'true',GRUK_NATIVE_REAL_BACKUP_ENABLED:'true'},open,write,log:x=>logs.push(x)});
 assert.equal(calls,1);
});
