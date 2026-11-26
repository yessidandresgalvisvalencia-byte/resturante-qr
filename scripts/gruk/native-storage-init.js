'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {constants}=require('node:fs');
async function initialize(base){
 if(typeof base!=='string'||!path.isAbsolute(base)||path.resolve(base)!==base||base===path.parse(base).root)throw Error('INVALID_BASE');
 if(await fs.realpath(path.dirname(base))!==path.dirname(base))throw Error('INVALID_PARENT');
 await fs.mkdir(base,{mode:0o700});
 const root=path.join(base,'vault'),keyFile=path.join(base,'signing.key');
 await fs.mkdir(root,{mode:0o700});
 const key=randomBytes(32);
 try{
  const h=await fs.open(keyFile,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await h.writeFile(key);await h.sync();}finally{await h.close();}
 }finally{key.fill(0);}
 for(const dir of [root,base,path.dirname(base)]){
  const h=await fs.open(dir,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  try{await h.sync();}finally{await h.close();}
 }
 return {root,keyFile,realBackupEnabled:false};
}
if(require.main===module){
 if(process.argv.length!==3){console.error('Usage: node native-storage-init.js /absolute/new/private-directory');process.exitCode=1;}
 else initialize(process.argv[2]).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('GRUK_STORAGE_INIT_FAILED');process.exitCode=1;});
}
module.exports={initialize};
