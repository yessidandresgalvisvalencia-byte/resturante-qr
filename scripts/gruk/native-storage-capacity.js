'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
async function inspect(root,{reserveBytes=104857600,maxAgeDays=30,now=Date.now()}={}){
 if(!root||!path.isAbsolute(root)||root===path.parse(root).root||await fs.realpath(root)!==root)throw Error('INVALID_ROOT');
 const st=await fs.lstat(root);
 if(!st.isDirectory()||(st.mode&0o077))throw Error('INVALID_ROOT');
 if(!Number.isSafeInteger(reserveBytes)||reserveBytes<0||!Number.isSafeInteger(maxAgeDays)||maxAgeDays<1||!Number.isFinite(now))throw Error('INVALID_POLICY');
 const disk=await fs.statfs(root,{bigint:true});
 const available=disk.bavail*disk.bsize;
 let bytes=0n,count=0,expired=0;
 for(const name of await fs.readdir(root)){
  if(!/^gruk-restaurante-[0-9]+-[0-9]+\.archive\.age$/.test(name))continue;
  const f=await fs.lstat(path.join(root,name),{bigint:true});
  if(!f.isFile()||(f.mode&0o077n))throw Error('UNSAFE_ARCHIVE');
  count++;bytes+=f.size;
  if(now-Number(f.mtimeMs)>maxAgeDays*86400000)expired++;
 }
 return {count,bytes:bytes.toString(),availableBytes:available.toString(),expired,lowCapacity:available<BigInt(reserveBytes),retentionMode:'report-only'};
}
module.exports={inspect};
