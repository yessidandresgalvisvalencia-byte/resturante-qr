'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const marker=/^\.used-token-([0-9]{1,16})-([a-f0-9]{32})$/;
async function syncDir(root){
 const h=await fs.open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
 try{await h.sync();}finally{await h.close();}
}
async function consume(root,claims,limit){
 if(!claims||!Number.isSafeInteger(claims.exp)||claims.exp<1||typeof claims.jti!=='string'||!/^[a-f0-9]{32}$/.test(claims.jti)||!Number.isSafeInteger(limit)||limit<1||limit>65536)throw Error('INVALID_REPLAY_POLICY');
 if(!root||!path.isAbsolute(root)||await fs.realpath(root)!==root||root===path.parse(root).root)throw Error('REPLAY_STORAGE_UNAVAILABLE');
 const st=await fs.lstat(root);
 if(!st.isDirectory()||(st.mode&0o077)||st.uid!==process.getuid())throw Error('REPLAY_STORAGE_UNAVAILABLE');
 const lock=path.join(root,'.token-replay.lock');
 await fs.mkdir(lock,{mode:0o700});
 try{
  const now=Math.floor(Date.now()/1000);
  if(claims.exp<=now)return 'replay';
  let count=0,seen=false;
  for(const name of await fs.readdir(root)){
   if(!name.startsWith('.used-token-'))continue;
   const m=marker.exec(name);
   if(!m||!Number.isSafeInteger(Number(m[1])))throw Error('REPLAY_STORAGE_UNAVAILABLE');
   const file=path.join(root,name),s=await fs.lstat(file);
   if(!s.isFile()||(s.mode&0o077)||s.uid!==process.getuid()||s.nlink!==1||s.size!==0)throw Error('REPLAY_STORAGE_UNAVAILABLE');
   if(Number(m[1])<=now){await fs.unlink(file);continue;}
   count++;if(m[2]===claims.jti)seen=true;
  }
  if(seen)return 'replay';
  if(count>=limit)return 'capacity';
  const file=path.join(root,'.used-token-'+claims.exp+'-'+claims.jti);
  const h=await fs.open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await h.sync();}finally{await h.close();}
  await syncDir(root);
  return 'ok';
 }finally{await fs.rmdir(lock);await syncDir(root);}
}
module.exports={consume,marker};
