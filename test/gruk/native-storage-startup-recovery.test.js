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

test('startup retries signed replica and fails closed on incomplete verification',async t=>{
 const {generateKeyPairSync}=require('node:crypto');
 const {createManifest}=require('../../scripts/gruk/drive-backup-manifest');
 const {signManifest,verifySignedManifest}=require('../../scripts/gruk/drive-manifest-signature');
 const {persistReceipt}=require('../../scripts/gruk/native-storage-receipt-recovery');
 const {createCatalog}=require('../../scripts/gruk/drive-backup-catalog');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gruk-start-replica-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const name='gruk-restaurante-1-1.archive.age',file=path.join(root,name);
 await fs.writeFile(file,'age-encryption.org/v1\n'+'x'.repeat(100),{mode:0o600});
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const keyring={verify:(r,n)=>verifySignedManifest(r,publicKey,n)};
 await persistReceipt({root,name,keyring,receipt:signManifest(await createManifest(file,name),privateKey)});
 const map=new Map();const catalog=createCatalog({keyring,store:{async putIfAbsent(n,v){if(map.has(n))return false;map.set(n,v);return true;},async get(n){return map.get(n);}}});
 let verified=false;
 const args={root,keyring,catalog,replicaRoot:'/synthetic/replica',validateRoots:async()=>{},replicate:async()=>({status:'REPLICATED',receiptVerified:verified,distinctDevice:true,restoreVerified:false})};
 await assert.rejects(recoverStartup(args),/RECOVERY_REPLICA_UNVERIFIED/);
 verified=true;assert.deepEqual(await recoverStartup(args),{status:'COMPLETED',checked:1,restoreVerified:false,replicasChecked:1});
 assert.equal(map.size,1);
});
