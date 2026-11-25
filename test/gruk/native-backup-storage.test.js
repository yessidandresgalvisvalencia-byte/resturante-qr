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
