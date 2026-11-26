'use strict';
const {createScheduler}=require('./native-storage-scheduler');
const {createAlertSink}=require('./native-storage-alerts');
function createOrchestrator({root,backup,write,intervalMs,policy,clock}){
 if(typeof backup!=='function')throw Error('BACKUP_ADAPTER_REQUIRED');
 const alert=createAlertSink({write});
 return createScheduler({root,backup,alert,intervalMs,policy,clock});
}
module.exports={createOrchestrator};
