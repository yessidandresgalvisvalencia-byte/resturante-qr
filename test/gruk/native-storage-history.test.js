'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {record}=require('../../scripts/gruk/native-storage-history');
test('journal survives independent processes and rejects unsafe paths',async t=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gruk-history-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const mod=require.resolve('../../scripts/gruk/native-storage-history');
 for(const code of ['BACKUP_OK','BACKUP_FAILED']){
  execFileSync(process.execPath,['-e','require(process.argv[1]).record(process.argv[2],{code:process.argv[3],at:123}).catch(()=>process.exit(1))',mod,root,code]);
 }
 const file=path.join(root,'backup-history.jsonl');
 const rows=(await fs.readFile(file,'utf8')).trim().split('\n').map(JSON.parse);
 assert.deepEqual(rows.map(r=>r.code),['BACKUP_OK','BACKUP_FAILED']);
 assert.notEqual(rows[0].id,rows[1].id);
 assert.equal((await fs.stat(file)).mode&0o777,0o600);
 await assert.rejects(record(root,{code:'SECRET',at:123}),/INVALID_EVENT/);
 await fs.rename(file,file+'.saved');
 await fs.symlink(file+'.saved',file);
 await assert.rejects(record(root,{code:'BACKUP_OK',at:123}));
 assert.equal((await fs.readFile(file+'.saved','utf8')).trim().split('\n').length,2);
});
