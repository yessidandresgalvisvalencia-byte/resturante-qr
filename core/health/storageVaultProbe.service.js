'use strict';
const {probeVault,safeProbeError}=require('../../scripts/gruk/native-storage-mongo-vault-connection');
async function connect(uri,opts){
 const c=require('mongoose').createConnection(uri,{...opts,bufferCommands:false,socketTimeoutMS:10000});
 try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}
}
async function runStartupVaultProbe({env=process.env,log=console.log,open=connect}={}){
 if(env.GRUK_VAULT_STARTUP_PROBE!=='true')return;
 if(env.GRUK_NATIVE_REAL_BACKUP_ENABLED==='true'){log('GRUK_VAULT_STARTUP_BLOCKED');return;}
 try{
  await probeVault({env:{...env,GRUK_VAULT_PROBE_ENABLED:'true',GRUK_NATIVE_REAL_BACKUP_ENABLED:'false'},connect:open});
  log('GRUK_VAULT_STARTUP_READ_ACCESS_VERIFIED');
 }catch(e){log('GRUK_VAULT_STARTUP_FAILED '+safeProbeError(e));}
}
module.exports={runStartupVaultProbe};
