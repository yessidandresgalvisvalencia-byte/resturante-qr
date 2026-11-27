'use strict';
const {probeVault,safeProbeError}=require('../../scripts/gruk/native-storage-mongo-vault-connection');
const {probeWrite}=require('../../scripts/gruk/native-storage-mongo-vault-write-probe');
async function connect(uri,opts){
 const c=require('mongoose').createConnection(uri,{...opts,bufferCommands:false,socketTimeoutMS:10000});
 try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}
}
async function runStartupVaultProbe({env=process.env,log=console.log,open=connect,write=probeWrite}={}){
 if(env.GRUK_VAULT_STARTUP_PROBE!=='true')return;
 if(env.GRUK_NATIVE_REAL_BACKUP_ENABLED==='true'){log('GRUK_VAULT_STARTUP_BLOCKED');return;}
 try{
  await probeVault({env:{...env,GRUK_VAULT_PROBE_ENABLED:'true',GRUK_NATIVE_REAL_BACKUP_ENABLED:'false'},connect:open});
  log('GRUK_VAULT_STARTUP_READ_ACCESS_VERIFIED');
  if(env.GRUK_VAULT_STARTUP_WRITE_PROBE==='true'){
   try{
    const result=await write({env:{...env,GRUK_VAULT_WRITE_PROBE_ENABLED:'true',GRUK_NATIVE_REAL_BACKUP_ENABLED:'false'},connect:open});
    if(result?.status!=='SYNTHETIC_WRITE_ABORT_VERIFIED')throw Error('VAULT_WRITE_UNVERIFIED');
    log('GRUK_VAULT_STARTUP_WRITE_ABORT_VERIFIED');
   }catch(e){log('GRUK_VAULT_STARTUP_WRITE_FAILED '+safeProbeError(e));}
  }
 }catch(e){log('GRUK_VAULT_STARTUP_FAILED '+safeProbeError(e));}
}
module.exports={runStartupVaultProbe};
