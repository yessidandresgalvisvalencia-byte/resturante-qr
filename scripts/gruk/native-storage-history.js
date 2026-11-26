'use strict';
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
async function record(root,event){
 if(!root||!path.isAbsolute(root)||root===path.parse(root).root||await fs.realpath(root)!==root)throw Error('INVALID_ROOT');
 const st=await fs.lstat(root);
 if(!st.isDirectory()||(st.mode&0o077))throw Error('INVALID_ROOT');
 if(!['BACKUP_OK','BACKUP_FAILED','LOW_CAPACITY','ALERT_FAILED'].includes(event.code)||!Number.isSafeInteger(event.at)||event.at<0)throw Error('INVALID_EVENT');
 const entry={id:randomUUID(),code:event.code,at:event.at};
 const file=path.join(root,'backup-history.jsonl');
 const h=await fs.open(file,constants.O_WRONLY|constants.O_APPEND|constants.O_CREAT|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);
 try{
  const s=await h.stat();
  if(!s.isFile()||(s.mode&0o077)||s.nlink!==1)throw Error('UNSAFE_JOURNAL');
  await h.writeFile(JSON.stringify(entry)+'\n');
  await h.sync();
 }finally{await h.close();}
 const dir=await fs.open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
 try{await dir.sync();}finally{await dir.close();}
 return entry;
}
module.exports={record};
