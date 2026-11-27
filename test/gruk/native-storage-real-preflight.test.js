'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateSource,checkIdentity,capacity,preflight}=require('../../scripts/gruk/native-storage-real-preflight');
const env={GRUK_STORAGE_PREFLIGHT_ENABLED:'true',GRUK_NATIVE_REAL_BACKUP_ENABLED:'false',GRUK_ENTERPRISE_BACKUP_URI:'mongodb+srv://gruk_enterprise_backup_reader:synthetic@source.mongodb.net/restaurante?authSource=admin',GRUK_ENTERPRISE_BACKUP_EXPECTED_HOST:'source.mongodb.net',GRUK_VAULT_EXPECTED_HOST:'vault.mongodb.net',GRUK_VAULT_MONGO_URI:'mongodb+srv://gruk_vault_worker:synthetic@vault.mongodb.net/gruk_storage_vault'};
const identity={authInfo:{authenticatedUsers:[{user:'gruk_enterprise_backup_reader',db:'admin'}],authenticatedUserRoles:[{role:'read',db:'restaurante'}]}};
test('source endpoint and exact role are fail closed',()=>{
 validateSource(env);checkIdentity(identity);
 for(const raw of [env.GRUK_ENTERPRISE_BACKUP_URI.replace('/restaurante','/gruk_finanzas_personales'),env.GRUK_ENTERPRISE_BACKUP_URI.replace('gruk_enterprise_backup_reader','root'),env.GRUK_ENTERPRISE_BACKUP_URI+'&tls=false',env.GRUK_ENTERPRISE_BACKUP_URI+'&authSource=admin'])assert.throws(()=>validateSource({...env,GRUK_ENTERPRISE_BACKUP_URI:raw}));
 assert.throws(()=>checkIdentity({authInfo:{...identity.authInfo,authenticatedUserRoles:[...identity.authInfo.authenticatedUserRoles,{role:'readWrite',db:'restaurante'}]}}),/SOURCE_ROLE_SCOPE/);
 assert.throws(()=>validateSource({...env,GRUK_VAULT_EXPECTED_HOST:'source.mongodb.net'}));
});
test('capacity remains a conservative internal screen, not physical quota evidence',()=>{
 assert.equal(capacity({dataSize:100,indexSize:100},{used:0}).internalCapacityScreenPassed,true);
 assert.equal(capacity({dataSize:100,indexSize:100},{used:32*1024*1024}).internalCapacityScreenPassed,false);
 assert.equal(capacity({dataSize:100,indexSize:100},{used:0}).atlasPhysicalCapacityVerified,false);
 assert.throws(()=>capacity({dataSize:100},{used:0}),/CAPACITY_UNVERIFIED/);
});
test('preflight only runs scoped read commands and closes connections',async()=>{
 const calls=[];
 const connect=async(uri,opts)=>({db:{databaseName:opts.dbName,command:async q=>{calls.push(Object.keys(q)[0]);return q.connectionStatus?identity:{dataSize:10,indexSize:20};},collection:n=>({findOne:async q=>{calls.push([n,q]);return {used:0};}})},close:async()=>calls.push('close')});
 const result=await preflight({env,connect});
 assert.equal(result.sourceRoleVerified,true);assert.equal(result.realBackupEnabled,false);assert.deepEqual(calls,['connectionStatus','dbStats',['vault_quota',{_id:'enterprise'}],'close','close']);
 await assert.rejects(preflight({env:{...env,GRUK_NATIVE_REAL_BACKUP_ENABLED:'true'},connect}),/PREFLIGHT_DISABLED/);
});

test('connection diagnostics isolate source and vault without leaking driver details',async()=>{
 const err=Object.assign(Error('synthetic secret must not leak'),{name:'MongoServerSelectionError'});
 await assert.rejects(preflight({env,connect:async()=>{throw err;}}),{message:'SOURCE_CONNECT_NETWORK_OR_TLS'});
 let closed=false;
 const connect=async(uri,opts)=>{if(opts.dbName==='gruk_storage_vault')throw Object.assign(Error('secret'),{code:18});return {db:{databaseName:'restaurante',command:async q=>q.connectionStatus?identity:{dataSize:10,indexSize:20}},close:async()=>{closed=true;}};};
 await assert.rejects(preflight({env,connect}),{message:'VAULT_CONNECT_AUTHENTICATION'});assert.equal(closed,true);
 await assert.rejects(preflight({env,connect:async()=>({db:{databaseName:'restaurante',command:async()=>{throw Object.assign(Error('secret'),{code:13});}},close:async()=>{}})}),{message:'SOURCE_IDENTITY_READ_PERMISSION'});
});
