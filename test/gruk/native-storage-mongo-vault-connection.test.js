'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateVaultUri,probeVault}=require('../../scripts/gruk/native-storage-mongo-vault-connection');
const host='vault.example.mongodb.net',uri='mongodb+srv://gruk_vault_worker:fake@'+host+'/gruk_storage_vault';
test('vault connection accepts only dedicated identity, host and database',()=>{
 validateVaultUri(uri,host);
 for(const bad of [uri.replace('gruk_vault_worker','gruk_storage_worker'),uri.replace('gruk_storage_vault','restaurante'),uri+'?tls=false',uri.replace(host,'other.mongodb.net')])assert.throws(()=>validateVaultUri(bad,host),/VAULT_ENDPOINT/);
});
test('read-only probe verifies quota and closes connection',async()=>{
 const env={GRUK_VAULT_PROBE_ENABLED:'true',GRUK_NATIVE_REAL_BACKUP_ENABLED:'false',GRUK_VAULT_MONGO_URI:uri,GRUK_VAULT_EXPECTED_HOST:host};
 const seen=[];let closed=false;
 const connect=async()=>({db:{databaseName:'gruk_storage_vault',collection(n){seen.push(n);return {findOne:async()=>n==='vault_quota'?{used:0}:null};}},close:async()=>{closed=true;}});
 await assert.rejects(probeVault({env:{...env,GRUK_NATIVE_REAL_BACKUP_ENABLED:'true'},connect:async()=>assert.fail()}),/DISABLED/);
 assert.deepEqual(await probeVault({env,connect}),{status:'READ_ACCESS_VERIFIED',used:0,realBackupEnabled:false,writePermissionsVerified:false});
 assert.deepEqual(seen,['vault_quota','archives','archive_chunks']);assert.equal(closed,true);
});

test('diagnostic output is limited to fixed safe codes',()=>{
 const {safeProbeError}=require('../../scripts/gruk/native-storage-mongo-vault-connection');
 assert.equal(safeProbeError(Error('VAULT_ENDPOINT_SCOPE')),'VAULT_ENDPOINT_SCOPE');
 assert.equal(safeProbeError({code:18,message:'secret password'}),'VAULT_AUTHENTICATION_FAILED');
 assert.equal(safeProbeError({name:'MongooseServerSelectionError',message:'secret URI'}),'VAULT_SERVER_UNREACHABLE');
 assert.equal(safeProbeError(Error('mongodb+srv://secret@example.net')),'VAULT_UNCLASSIFIED');
});
