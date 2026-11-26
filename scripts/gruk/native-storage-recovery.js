'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {marker}=require('./native-storage-replay');
async function inspectRecovery(root){
 if(!root||!path.isAbsolute(root)||root===path.parse(root).root||await fs.realpath(root)!==root)throw Error('INVALID_ROOT');
 const st=await fs.lstat(root);
 if(!st.isDirectory()||(st.mode&0o077)||st.uid!==process.getuid())throw Error('INVALID_ROOT');
 const entries=await fs.readdir(root,{withFileTypes:true});
 const locks=new Set(['.backup.lock','.token-replay.lock']);
 const lockPresent=entries.some(e=>locks.has(e.name));
 const unexpectedEntries=entries.filter(e=>!locks.has(e.name)&&e.name!=='backup-history.jsonl'&&!marker.test(e.name)&&!/^gruk-restaurante-[0-9]+-[0-9]+\.archive\.age(?:\.receipt\.json)?$/.test(e.name)).length;
 let unsafeEntries=false;
 for(const entry of entries){
  const s=await fs.lstat(path.join(root,entry.name));
  const token=marker.exec(entry.name);
  if((s.mode&0o077)||s.uid!==process.getuid()||(locks.has(entry.name)?!s.isDirectory():(!s.isFile()||s.nlink!==1))||(token&&(s.size!==0||!Number.isSafeInteger(Number(token[1])))))unsafeEntries=true;
 }
 return {status:lockPresent||unexpectedEntries||unsafeEntries?'review-required':'clear',lockPresent,unexpectedEntries,unsafeEntries,automaticDeletion:false};
}
module.exports={inspectRecovery};
