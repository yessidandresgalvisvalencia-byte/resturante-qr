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
