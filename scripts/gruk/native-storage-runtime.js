'use strict';
const {createOrchestrator}=require('./native-storage-orchestrator');
const {createBackupAdapter}=require('./native-storage-backup-adapter');
const {start}=require('./native-storage-service');
function createRuntime({env=process.env,launch=start,execute}={}){
 if(env.GRUK_NATIVE_REAL_BACKUP_ENABLED==='true')throw Error('REAL_BACKUP_RELEASE_BLOCKED');
 const root=env.GRUK_NATIVE_BACKUP_ROOT;
 if(!root)throw Error('INVALID_CONFIG');
 const backup=createBackupAdapter({env:{...env,GRUK_NATIVE_REAL_BACKUP_ENABLED:'false'},execute});
 const scheduler=createOrchestrator({root,backup});
 return {async start(){await launch();},status(){return {realBackupEnabled:false,scheduler:scheduler.status()};}};
}
if(require.main===module)Promise.resolve().then(()=>createRuntime().start()).catch(()=>{console.error('GRUK_STORAGE_RUNTIME_FAILED');process.exitCode=1;});
module.exports={createRuntime};
