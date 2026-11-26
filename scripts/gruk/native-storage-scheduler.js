'use strict';
const {inspect}=require('./native-storage-capacity');
const {record}=require('./native-storage-history');
const {acquire}=require('./native-storage-lock');
function createScheduler({root,backup,alert,intervalMs=86400000,policy={},clock=Date.now}){
 if(typeof backup!=='function'||typeof alert!=='function'||!Number.isSafeInteger(intervalMs)||intervalMs<1000||intervalMs>2147483647)throw Error('INVALID_CONFIG');
 let busy=false,timer=null,lastSuccess=null,lastFailure=null;
 async function tick(){
  if(busy)return {status:'busy'};
  busy=true;
  let release;
  try{
   release=await acquire(root);
   if(!release)return {status:'busy'};
   const capacity=await inspect(root,policy);
   if(capacity.lowCapacity)throw Error('LOW_CAPACITY');
   await backup();
   lastSuccess=clock();
   await record(root,{code:'BACKUP_OK',at:lastSuccess});
   return {status:'ok'};
  }catch(e){
   lastFailure=clock();
   const code=e.message==='LOW_CAPACITY'?'LOW_CAPACITY':'BACKUP_FAILED';
   let journalFailed=false;
   try{await record(root,{code,at:lastFailure});}catch{journalFailed=true;}
   try{await alert({code,at:lastFailure});}catch{
    try{await record(root,{code:'ALERT_FAILED',at:lastFailure});}catch{journalFailed=true;}
    return {status:'failed',code,alertFailed:true,...(journalFailed?{journalFailed:true}:{})};
   }
   return {status:'failed',code,...(journalFailed?{journalFailed:true}:{})};
  }finally{try{if(release)await release();}finally{busy=false;}}
 }
 return {tick,start(){if(timer===null)timer=setInterval(()=>{void tick().catch(()=>{console.error('GRUK_STORAGE_LOCK_RELEASE_FAILED');});},intervalMs);},stop(){if(timer!==null)clearInterval(timer);timer=null;},status(){return {busy,lastSuccess,lastFailure,running:timer!==null};}};
}
module.exports={createScheduler};
