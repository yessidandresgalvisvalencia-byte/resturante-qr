'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const {listenLocal}=require('./native-storage-api');
async function start(){
 const root=process.env.GRUK_NATIVE_BACKUP_ROOT;
 const secret=process.env.GRUK_STORAGE_SIGNING_KEY_FILE;
 const port=Number(process.env.GRUK_STORAGE_PORT||8787);
 if(!root||!path.isAbsolute(root)||root===path.parse(root).root||!secret||!path.isAbsolute(secret)||!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_CONFIG');
 if(await fs.realpath(path.dirname(root))!==path.dirname(root))throw Error('INVALID_PARENT');
 await fs.mkdir(root,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 const stat=await fs.lstat(root);
 if(!stat.isDirectory()||(stat.mode&0o077)||await fs.realpath(root)!==root)throw Error('INVALID_VOLUME');
 const h=await fs.open(secret,constants.O_RDONLY|constants.O_NOFOLLOW);
 let key;
 try{const s=await h.stat();if(!s.isFile()||(s.mode&0o077)||s.size!==32)throw Error('INVALID_KEY_FILE');key=await h.readFile();}finally{await h.close();}
 const server=listenLocal({root,key},port);
 server.on('error',()=>{key.fill(0);process.exitCode=1;console.error('GRUK_STORAGE_LISTENER_FAILED');});
 server.on('listening',()=>console.log('GRUK_STORAGE_LOCAL_READY'));
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>key.fill(0));server.closeIdleConnections();});
}
if(require.main===module)start().catch(()=>{console.error('GRUK_STORAGE_START_FAILED');process.exitCode=1;});
module.exports={start};
