'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
async function acquire(root){
 if(!root||!path.isAbsolute(root)||root===path.parse(root).root||await fs.realpath(root)!==root)throw Error('INVALID_ROOT');
 const st=await fs.lstat(root);
 if(!st.isDirectory()||(st.mode&0o077))throw Error('INVALID_ROOT');
 const lock=path.join(root,'.backup.lock');
 try{await fs.mkdir(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')return null;throw e;}
 let released=false;
 return async()=>{if(!released){await fs.rmdir(lock);released=true;}};
}
module.exports={acquire};
