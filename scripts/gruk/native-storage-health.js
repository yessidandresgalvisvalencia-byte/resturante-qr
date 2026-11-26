'use strict';
const {inspect}=require('./native-storage-capacity');
const {inspectRecovery}=require('./native-storage-recovery');
async function health({root,service,policy}={}){
 const state=service?.status?.();
 if(!state?.listening||state.closing)return {status:'unavailable',code:'LISTENER_NOT_READY',realBackupReady:false};
 try{
  const capacity=await inspect(root,policy);
  const recovery=await inspectRecovery(root);
  if(recovery.status!=='clear')return {status:'degraded',code:'RECOVERY_REVIEW_REQUIRED',realBackupReady:false,capacity,recovery};
  return {status:capacity.lowCapacity?'degraded':'ready',code:capacity.lowCapacity?'LOW_CAPACITY':'LOCAL_STORAGE_READY',realBackupReady:false,capacity};
 }catch{return {status:'unavailable',code:'STORAGE_CHECK_FAILED',realBackupReady:false};}
}
module.exports={health};
