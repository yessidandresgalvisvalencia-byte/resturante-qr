'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {recoverStartup}=require('../../scripts/gruk/native-storage-startup-recovery');
const {createRuntime}=require('../../scripts/gruk/native-storage-runtime');
test('startup recovery refuses unsigned archives and releases lock',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gruk-startup-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const args={root,keyring:{},catalog:{}};
 assert.deepEqual(await recoverStartup(args),{status:'COMPLETED',checked:0,restoreVerified:false});
 await fs.writeFile(path.join(root,'gruk-restaurante-1-1.archive.age'),'synthetic',{mode:0o600});
 await assert.rejects(recoverStartup(args),/RECOVERY_UNPAIRED/);
 await assert.rejects(fs.stat(path.join(root,'.backup.lock')),{code:'ENOENT'});
});
test('enabled startup recovery runs before listener and failure blocks launch',async()=>{
 const env={GRUK_NATIVE_BACKUP_ROOT:'/synthetic/vault',GRUK_NATIVE_STARTUP_RECOVERY_ENABLED:'true'};
 let launched=0;
 const runtime=createRuntime({env,signals:false,recover:async()=>{throw Error('RECOVERY_UNPAIRED');},launch:async()=>{launched++;}});
 await assert.rejects(runtime.start(),/RECOVERY_UNPAIRED/);
 assert.equal(launched,0);
 await assert.rejects(runtime.shutdown(),/RECOVERY_UNPAIRED/);
});
