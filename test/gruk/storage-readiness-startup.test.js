'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {runStartupReadiness}=require('../../core/health/storageReadinessProbe.service');
const now=()=>Date.parse('2026-01-01T00:00:00Z');
const env={GRUK_STORAGE_STARTUP_READINESS:'true',GRUK_STORAGE_STARTUP_READINESS_EXPIRES_AT:'2026-01-01T00:30:00Z',GRUK_NATIVE_REAL_BACKUP_ENABLED:'false',GRUK_STORAGE_PREFLIGHT_ENABLED:'true',GRUK_ENTERPRISE_BACKUP_URI:'mongodb+srv://gruk_enterprise_backup_reader:synthetic@source.mongodb.net/restaurante',GRUK_ENTERPRISE_BACKUP_EXPECTED_HOST:'source.mongodb.net',GRUK_VAULT_MONGO_URI:'mongodb+srv://gruk_vault_worker:synthetic@vault.mongodb.net/gruk_storage_vault',GRUK_VAULT_EXPECTED_HOST:'vault.mongodb.net'};
test('startup readiness defaults off, expires, blocks writes and runs once with redacted failure',async()=>{
 const logs=[],log=x=>logs.push(x),never=()=>assert.fail('connection not authorized');
 await runStartupReadiness({env:{},connect:never,log,now});assert.deepEqual(logs,[]);
 for(const patch of [{GRUK_STORAGE_STARTUP_READINESS_EXPIRES_AT:'2025-12-31T00:00:00Z'},{GRUK_STORAGE_STARTUP_READINESS_EXPIRES_AT:'2026-01-01T02:00:00Z'},{GRUK_NATIVE_REAL_BACKUP_ENABLED:'true'},{GRUK_VAULT_STARTUP_WRITE_PROBE:'true'},{GRUK_STORAGE_PREFLIGHT_ENABLED:'false'}]){
  await runStartupReadiness({env:{...env,...patch},connect:never,log,now});assert.equal(logs.at(-1),'GRUK_STORAGE_STARTUP_READINESS_BLOCKED');
 }
 let count=0;
 await runStartupReadiness({env,now,log,connect:async()=>{count++;throw Error('private synthetic connection detail');}});
 assert.equal(logs.at(-1),'GRUK_STORAGE_STARTUP_READINESS_FAILED SOURCE_CONNECT_OTHER');
 await runStartupReadiness({env,now,log,connect:never});assert.equal(count,1);
});
