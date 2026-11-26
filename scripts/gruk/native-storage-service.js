'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const {listenLocal}=require('./native-storage-api');
async function start({env=process.env,signals=true}={}){
 const root=env.GRUK_NATIVE_BACKUP_ROOT;
 const secret=env.GRUK_STORAGE_SIGNING_KEY_FILE;
 const port=Number(env.GRUK_STORAGE_PORT||8787);
 if(!root||!path.isAbsolute(root)||root===path.parse(root).root||!secret||!path.isAbsolute(secret)||!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_CONFIG');
 if(await fs.realpath(path.dirname(root))!==path.dirname(root))throw Error('INVALID_PARENT');
 await fs.mkdir(root,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 const stat=await fs.lstat(root);
 if(!stat.isDirectory()||(stat.mode&0o077)||stat.uid!==process.getuid()||await fs.realpath(root)!==root)throw Error('INVALID_VOLUME');
 if(await fs.realpath(path.dirname(secret))!==path.dirname(secret))throw Error('INVALID_KEY_PARENT');
 const h=await fs.open(secret,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 let key;
 try{const s=await h.stat();if(!s.isFile()||(s.mode&0o077)||s.uid!==process.getuid()||s.nlink!==1||s.size!==32)throw Error('INVALID_KEY_FILE');key=await h.readFile();}finally{await h.close();}
 const server=listenLocal({root,key},port);
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.once('listening',()=>{server.removeListener('error',reject);resolve();});
 }).catch(error=>{key.fill(0);throw error;});
 let closing;
 const shutdown=()=>{
  if(!closing)closing=new Promise((resolve,reject)=>{
   for(const signal of ['SIGTERM','SIGINT'])process.removeListener(signal,onSignal);
   server.close(error=>{key.fill(0);error?reject(error):resolve();});
   server.closeIdleConnections();
  });
  return closing;
 };
 const onSignal=()=>{shutdown().catch(()=>{process.exitCode=1;console.error('GRUK_STORAGE_STOP_FAILED');});};
 if(signals)for(const signal of ['SIGTERM','SIGINT'])process.once(signal,onSignal);
 console.log('GRUK_STORAGE_LOCAL_READY');
 return {shutdown,status:()=>({listening:server.listening,closing:Boolean(closing)})};
}
if(require.main===module)start().catch(()=>{console.error('GRUK_STORAGE_START_FAILED');process.exitCode=1;});
module.exports={start};
