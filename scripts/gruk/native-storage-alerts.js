'use strict';
function createAlertSink({write=process.stderr.write.bind(process.stderr)}={}){
 if(typeof write!=='function')throw Error('INVALID_SINK');
 return async function alert(event){
  if(!event||!['LOW_CAPACITY','BACKUP_FAILED'].includes(event.code)||!Number.isSafeInteger(event.at)||event.at<0)throw Error('INVALID_ALERT');
  const line=JSON.stringify({service:'gruk-storage',severity:'error',code:event.code,at:event.at})+'\n';
  await new Promise((resolve,reject)=>{write(line,error=>error?reject(Error('ALERT_DELIVERY_FAILED')):resolve());});
 };
}
module.exports={createAlertSink};
