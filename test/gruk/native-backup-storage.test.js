'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {store,retrieve}=require('../../scripts/gruk/native-backup-storage');
test('private volume roundtrip, no overwrite, traversal and digest guards',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gruk-native-'));
 try{
 const source=path.join(root,'source.age'), dest=path.join(root,'restored.age');
 const name='gruk-restaurante-1-1.archive.age';
 const data='age-encryption.org/v1\n'+ 'synthetic fixture only'.repeat(5);
 await fs.writeFile(source,data);
 const receipt=await store(root,name,source);
 await retrieve(root,name,dest,receipt.sha256);
 assert.equal(await fs.readFile(dest,'utf8'),data);
 await assert.rejects(store(root,name,source),{code:'EEXIST'});
 await assert.rejects(store(root,'../escape.age',source),/INVALID_BACKUP_NAME/);
 await assert.rejects(retrieve(root,name,dest+'2','0'.repeat(64)),/BACKUP_INTEGRITY_MISMATCH/);
 await assert.rejects(fs.stat(dest+'2'),{code:'ENOENT'});
 await fs.writeFile(source,'plaintext'.repeat(20));
 await assert.rejects(store(root,'gruk-restaurante-2-1.archive.age',source),/AGE_ARCHIVE_REQUIRED/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('adapter rejects unsafe archive permissions, links and nonregular inputs',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gruk-storage-security-')));
 try{
  const name='gruk-restaurante-2-1.archive.age', source=path.join(root,'source.age'),dest=path.join(root,'restore.age');
  await fs.writeFile(source,'age-encryption.org/v1\n'+'synthetic'.repeat(20),{mode:0o600});
  await assert.rejects(store(root,name,root),/AGE_ARCHIVE_REQUIRED/);
  const alias=path.join(root,'alias.age');await fs.symlink(source,alias);
  await assert.rejects(store(root,name,alias),{code:'ELOOP'});
  const receipt=await store(root,name,source);
  const archive=path.join(root,name);
  await fs.chmod(archive,0o644);
  await assert.rejects(retrieve(root,name,dest,receipt.sha256),/INVALID_ARCHIVE/);
  await fs.chmod(archive,0o600);
  const link=path.join(root,'hardlink.age');await fs.link(archive,link);
  await assert.rejects(retrieve(root,name,dest,receipt.sha256),/INVALID_ARCHIVE/);
  await fs.unlink(link);
  await retrieve(root,name,dest,receipt.sha256);
  assert.deepEqual(await fs.readFile(dest),await fs.readFile(source));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
