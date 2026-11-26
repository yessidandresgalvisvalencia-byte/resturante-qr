'use strict';
const {createOrchestrator}=require('./native-storage-orchestrator');
const {createBackupAdapter}=require('./native-storage-backup-adapter');
const {start}=require('./native-storage-service');
const {health}=require('./native-storage-health');
const {runStartupRecovery}=require('./native-storage-startup-recovery');
async function defaultConnect(uri,opts){const c=require('mongoose').createConnection(uri,opts);try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}}
function createRuntime({env=process.env,launch=start,execute,syntheticBackup,write,intervalMs,policy,signals=true,connect=defaultConnect,recover=runStartupRecovery}={}){
 if(env.GRUK_NATIVE_REAL_BACKUP_ENABLED==='true')throw Error('REAL_BACKUP_RELEASE_BLOCKED');
 const root=env.GRUK_NATIVE_BACKUP_ROOT;
 if(!root)throw Error('INVALID_CONFIG');
 if(syntheticBackup!==undefined&&typeof syntheticBackup!=='function')throw Error('INVALID_SYNTHETIC_BACKUP');
 const backup=syntheticBackup||createBackupAdapter({env:{...env,GRUK_NATIVE_REAL_BACKUP_ENABLED:'false'},execute});
 const scheduler=createOrchestrator({root,backup,write,intervalMs,policy});
 let service,starting,closing;
 const onSignal=()=>{void shutdown().catch(()=>{process.exitCode=1;console.error('GRUK_STORAGE_RUNTIME_STOP_FAILED');});};
 async function shutdown(){
  if(!closing)closing=(async()=>{
   try{if(starting)await starting;}finally{
    for(const signal of ['SIGTERM','SIGINT'])process.removeListener(signal,onSignal);
    await scheduler.stop();
    if(service)await service.shutdown();
   }
  })();
  return closing;
 }
 return {start(){
  if(closing)throw Error('RUNTIME_CLOSED');
  if(!starting)starting=(async()=>{
   if(env.GRUK_NATIVE_STARTUP_RECOVERY_ENABLED==='true')await recover({env,connect});
   service=await launch({env,signals:false});
   if(signals)for(const signal of ['SIGTERM','SIGINT'])process.once(signal,onSignal);
   if(syntheticBackup)scheduler.start();
  })();
  return starting;
 },async health(){return health({root,service,replicationRequired:env.GRUK_NATIVE_REPLICATION_REQUIRED==='true',replicaRoot:env.GRUK_NATIVE_REPLICA_ROOT});},shutdown,status(){return {realBackupEnabled:false,scheduler:scheduler.status()};}};
}
if(require.main===module)Promise.resolve().then(()=>createRuntime().start()).catch(()=>{console.error('GRUK_STORAGE_RUNTIME_FAILED');process.exitCode=1;});
module.exports={createRuntime};
