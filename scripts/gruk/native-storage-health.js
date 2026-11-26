'use strict';
const {inspect}=require('./native-storage-capacity');
async function health({root,service,policy}={}){
 const state=service?.status?.();
 if(!state?.listening||state.closing)return {status:'unavailable',code:'LISTENER_NOT_READY',realBackupReady:false};
 try{
  const capacity=await inspect(root,policy);
  return {status:capacity.lowCapacity?'degraded':'ready',code:capacity.lowCapacity?'LOW_CAPACITY':'LOCAL_STORAGE_READY',realBackupReady:false,capacity};
 }catch{return {status:'unavailable',code:'STORAGE_CHECK_FAILED',realBackupReady:false};}
}
module.exports={health};
