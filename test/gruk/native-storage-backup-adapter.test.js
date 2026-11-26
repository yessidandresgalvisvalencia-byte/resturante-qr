'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBackupAdapter}=require('../../scripts/gruk/native-storage-backup-adapter');
test('adapter denies unauthorized execution and validates simulated results',async()=>{
 let calls=0,mode='ok';
 const env={GRUK_NATIVE_REAL_BACKUP_ENABLED:'true',GRUK_BACKUP_APPROVAL:'RESPALDAR_SOLO_RESTAURANTE',GRUK_ENTERPRISE_DB:'restaurante',GRUK_ENTERPRISE_DB_CONFIRM:'restaurante',UNRELATED_SECRET:'synthetic'};
 const execute=(cmd,args,opts,cb)=>{
  calls++;
  assert.equal(cmd,'/bin/bash');
  assert.match(args[0],/native-backup-restore\.sh$/);
  assert.equal(opts.timeout,1000);
  assert.equal(opts.env.UNRELATED_SECRET,undefined);
  assert.match(opts.env.GITHUB_RUN_ID,/^\d+$/);
  cb(mode==='error'?Error('private synthetic error'):null,mode==='ok'?'GRUK_NATIVE_BACKUP_REAL_RESTORE_OK: synthetic':'');
 };
 await assert.rejects(createBackupAdapter({env:{},execute})(),/BACKUP_NOT_AUTHORIZED/);
 await assert.rejects(createBackupAdapter({env:{...env,GRUK_ENTERPRISE_DB:'personal'},execute})(),/BACKUP_NOT_AUTHORIZED/);
 assert.equal(calls,0);
 const backup=createBackupAdapter({env,execute,timeoutMs:1000});
 await backup();
 mode='error';await assert.rejects(backup(),/BACKUP_EXECUTION_FAILED/);
 mode='missing';await assert.rejects(backup(),/BACKUP_EXECUTION_FAILED/);
 assert.equal(calls,3);
 assert.throws(()=>createBackupAdapter({timeoutMs:1}),/INVALID_TIMEOUT/);
});
