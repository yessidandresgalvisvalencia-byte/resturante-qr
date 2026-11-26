'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {health}=require('../../scripts/gruk/native-storage-health');
test('health reports readiness without authorizing real backups',async t=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gruk-health-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const service={status:()=>({listening:true,closing:false})};
 const ready=await health({root,service,policy:{reserveBytes:0}});
 assert.equal(ready.status,'ready');
 assert.equal(ready.realBackupReady,false);
 const degraded=await health({root,service,policy:{reserveBytes:Number.MAX_SAFE_INTEGER}});
 assert.equal(degraded.status,'degraded');
 assert.equal(degraded.code,'LOW_CAPACITY');
 assert.equal((await health({root})).code,'LISTENER_NOT_READY');
 assert.equal((await health({root,service:{status:()=>({listening:true,closing:true})}})).status,'unavailable');
 assert.equal((await health({root:path.join(root,'missing'),service})).code,'STORAGE_CHECK_FAILED');
});

test('health flags recovery review without removing lock',async t=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gruk-health-recovery-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const service={status:()=>({listening:true,closing:false})};
 await fs.mkdir(path.join(root,'.backup.lock'),{mode:0o700});
 const result=await health({root,service,policy:{reserveBytes:0}});
 assert.equal(result.status,'degraded');
 assert.equal(result.code,'RECOVERY_REVIEW_REQUIRED');
 assert.equal(result.realBackupReady,false);
 assert.equal(result.recovery.lockPresent,true);
 assert.ok((await fs.stat(path.join(root,'.backup.lock'))).isDirectory());
});
