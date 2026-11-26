'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBackupAdapter}=require('../../scripts/gruk/native-storage-backup-adapter');
const {prepareSignedRegistration}=require('../../scripts/gruk/native-storage-signed-runtime');
test('signed cycle preflights configuration, binds run identity and fails closed',async()=>{
 const env={GRUK_NATIVE_REAL_BACKUP_ENABLED:'true',GRUK_BACKUP_APPROVAL:'RESPALDAR_SOLO_RESTAURANTE',GRUK_ENTERPRISE_DB:'restaurante',GRUK_ENTERPRISE_DB_CONFIRM:'restaurante',GRUK_CATALOG_ENABLED:'true',GRUK_NATIVE_SIGNED_REGISTRATION_ENABLED:'true'};
 let calls=0,registered=0,match=true;
 const execute=(cmd,args,opts,cb)=>{calls++;cb(null,'GRUK_NATIVE_BACKUP_REAL_RESTORE_OK: synthetic\nBACKUP_RUN_ID='+(match?opts.env.GITHUB_RUN_ID:'wrong')+'-1\n');};
 assert.throws(()=>prepareSignedRegistration(env,()=>{}),/NATIVE_SIGNED_REGISTRATION_CONFIG/);
 await assert.rejects(createBackupAdapter({env,execute})(),/NATIVE_SIGNED_REGISTRATION_CONFIG/);
 assert.equal(calls,0);
 const prepareRegistration=()=>async name=>{registered++;return {name,status:'REGISTERED',restoreVerified:false};};
 const backup=createBackupAdapter({env,execute,prepareRegistration});
 await backup();assert.equal(registered,1);
 match=false;await assert.rejects(backup(),/BACKUP_RUN_ID_UNVERIFIED/);assert.equal(registered,1);
 await assert.rejects(createBackupAdapter({env:{...env,GRUK_NATIVE_SIGNED_REGISTRATION_ENABLED:'false'},execute})(),/NATIVE_SIGNED_REGISTRATION_REQUIRED/);
});

test('required replication blocks backup before preflight and rejects incomplete copies',async()=>{
 const env={GRUK_NATIVE_REAL_BACKUP_ENABLED:'true',GRUK_BACKUP_APPROVAL:'RESPALDAR_SOLO_RESTAURANTE',GRUK_ENTERPRISE_DB:'restaurante',GRUK_ENTERPRISE_DB_CONFIRM:'restaurante',GRUK_CATALOG_ENABLED:'true',GRUK_NATIVE_SIGNED_REGISTRATION_ENABLED:'true',GRUK_NATIVE_REPLICATION_REQUIRED:'true'};
 let calls=0,preflight=0,verified=false,ready=false;
 const execute=(cmd,args,opts,cb)=>{calls++;cb(null,'GRUK_NATIVE_BACKUP_REAL_RESTORE_OK: synthetic\nBACKUP_RUN_ID='+opts.env.GITHUB_RUN_ID+'-1\n');};
 const prepareRegistration=()=>Object.assign(async name=>({name,status:'REGISTERED',restoreVerified:false,replicationVerified:verified}),{preflight:async()=>{preflight++;if(!ready)throw Error('REPLICA_DEVICE_NOT_DISTINCT');}});
 const backup=createBackupAdapter({env,execute,prepareRegistration});
 await assert.rejects(backup(),/REPLICA_DEVICE_NOT_DISTINCT/);assert.equal(calls,0);
 ready=true;await assert.rejects(backup(),/NATIVE_REPLICATION_UNVERIFIED/);
 verified=true;await backup();assert.equal(calls,2);assert.equal(preflight,3);
});
