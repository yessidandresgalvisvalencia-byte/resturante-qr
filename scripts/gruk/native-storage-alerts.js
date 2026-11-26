'use strict';
function createAlertSink({write=process.stderr.write.bind(process.stderr) ,timeoutMs=5000}={}){
 if(typeof write!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('INVALID_SINK');
 return async function alert(event){
  if(!event||!['LOW_CAPACITY','BACKUP_FAILED'].includes(event.code)||!Number.isSafeInteger(event.at)||event.at<0)throw Error('INVALID_ALERT');
  const line=JSON.stringify({service:'gruk-storage',severity:'error',code:event.code,at:event.at})+'\n';
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('ALERT_DELIVERY_FAILED')),timeoutMs);
   const done=error=>{clearTimeout(timer);error?reject(Error('ALERT_DELIVERY_FAILED')):resolve();};
   try{write(line,done);}catch{done(true);}
  });
 };
}
module.exports={createAlertSink};
