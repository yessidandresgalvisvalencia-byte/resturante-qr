'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {provision}=require('../../scripts/gruk/native-storage-key-provision');
test('exclusive private provisioning, no output secrets and no overwrite',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'gruk-key-'));
 try{
  const root=path.join(parent,'new');
  const age=(cmd,args)=>{if(args[0]==='-o'){fs.writeFileSync(args[1],'synthetic only',{mode:0o600});return Buffer.alloc(0);}return Buffer.from('age1'+'q'.repeat(58));};
  assert.deepEqual(provision({root,age}),{status:'KEY_FILES_CREATED',independentCustodyVerified:false,realBackupEnabled:false});
  for(const n of ['recovery.agekey','signer.pem','public.json'])assert.equal(fs.statSync(path.join(root,n)).mode&0o777,0o600);
  assert.throws(()=>provision({root,age}));
  const failed=path.join(parent,'failed');
  assert.throws(()=>provision({root:failed,age:()=>{throw Error('secret');}}),/KEY_PROVISION_FAILED/);
  assert.equal(fs.existsSync(failed),false);
  fs.chmodSync(parent,0o755);
  assert.throws(()=>provision({root:path.join(parent,'insecure'),age}),/KEY_PARENT_INSECURE/);
 }finally{fs.rmSync(parent,{recursive:true,force:true});}
});
