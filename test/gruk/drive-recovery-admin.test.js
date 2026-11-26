'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runAdminRecovery}=require('../../scripts/gruk/drive-recovery-admin');
const env={GRUK_CATALOG_ENABLED:'true',GRUK_ADMIN_RECOVERY_ENABLED:'true',GRUK_CATALOG_ADMIN_URI:'mongodb+srv://admin:fake@catalog.example.mongodb.net/gruk_storage_catalog',GRUK_CATALOG_MONGO_URI:'mongodb+srv://worker:fake@catalog.example.mongodb.net/gruk_storage_catalog',GRUK_ENTERPRISE_BACKUP_URI:'mongodb+srv://source:fake@source.example.mongodb.net/restaurante',GRUK_CATALOG_EXPECTED_HOST:'catalog.example.mongodb.net'};
const args={owner:'12345678-1234-4123-8123-123456789abc',startedAt:0,evidenceId:'incident-123',approval:'CONFIRM_WORKER_TERMINATED',now:()=>3600000,env};
test('administrative recovery requires separate credentials and explicit activation before connection',async()=>{
 const connect=async()=>assert.fail('unexpected connection');
 await assert.rejects(runAdminRecovery({...args,connect,env:{...env,GRUK_ADMIN_RECOVERY_ENABLED:'false'}}),/DISABLED/);
 await assert.rejects(runAdminRecovery({...args,connect,env:{...env,GRUK_CATALOG_ADMIN_URI:env.GRUK_CATALOG_MONGO_URI}}),/SEPARATION/);
 await assert.rejects(runAdminRecovery({...args,connect,startedAt:3599999}),/INPUT/);
});
test('admin runtime closes connection and never falls back when transaction fails',async()=>{
 let closed=0,ended=0;
 const connect=async()=>({db:{databaseName:'gruk_storage_catalog'},getClient(){return {startSession(){return {async withTransaction(){throw Error('transaction unavailable');},async endSession(){ended++;}};}};},async close(){closed++;}});
 await assert.rejects(runAdminRecovery({...args,connect}),/transaction unavailable/);
 assert.equal(closed,1);assert.equal(ended,1);
});
