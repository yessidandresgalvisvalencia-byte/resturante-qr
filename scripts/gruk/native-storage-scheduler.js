'use strict';
const {inspect}=require('./native-storage-capacity');
function createScheduler({root,backup,alert,intervalMs=86400000,policy={},clock=Date.now}){
 if(typeof backup!=='function'||typeof alert!=='function'||!Number.isSafeInteger(intervalMs)||intervalMs<1000||intervalMs>2147483647)throw Error('INVALID_CONFIG');
 let busy=false,timer=null,lastSuccess=null,lastFailure=null;
 async function tick(){
  if(busy)return {status:'busy'};
  busy=true;
  try{
   const capacity=await inspect(root,policy);
   if(capacity.lowCapacity)throw Error('LOW_CAPACITY');
   await backup();
   lastSuccess=clock();
   return {status:'ok'};
  }catch(e){
   lastFailure=clock();
   const code=e.message==='LOW_CAPACITY'?'LOW_CAPACITY':'BACKUP_FAILED';
   try{await alert({code,at:lastFailure});}catch{return {status:'failed',code,alertFailed:true};}
   return {status:'failed',code};
  }finally{busy=false;}
 }
 return {tick,start(){if(timer===null)timer=setInterval(()=>{void tick();},intervalMs);},stop(){if(timer!==null)clearInterval(timer);timer=null;},status(){return {busy,lastSuccess,lastFailure,running:timer!==null};}};
}
module.exports={createScheduler};
