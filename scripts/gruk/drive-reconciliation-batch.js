'use strict';
const NAME=/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/;
const CODES=new Set(['CATALOG_MISSING','CATALOG_UNVERIFIED','REMOTE_UNAVAILABLE','REMOTE_UNVERIFIED','UPLOAD_NOT_CONFIRMED','DUPLICATE_REMOTE_OBJECTS','REMOTE_SIZE_MISMATCH','RESTORE_VERIFICATION_REQUIRED','ARCHIVE_MISSING','ARCHIVE_UNVERIFIED','ARCHIVE_SIZE_MISMATCH','ARCHIVE_DIGEST_MISMATCH','VAULT_UNVERIFIED']);
function createBatchRunner({inspect,alert,now=Date.now,intervalMs=86400000,maxItems=10}){
 if(typeof inspect!=='function'||typeof alert!=='function'||!Number.isSafeInteger(intervalMs)||intervalMs<3600000||!Number.isSafeInteger(maxItems)||maxItems<1||maxItems>20)throw Error('BATCH_CONFIG');
 let running=false,lastAttempt=-1;
 return async function run(names){
  if(!Array.isArray(names)||names.length<1||names.length>maxItems||names.some(n=>typeof n!=='string'||!NAME.test(n)))throw Error('BATCH_NAMES');
  const at=now();
  if(!Number.isSafeInteger(at)||at<0)throw Error('BATCH_CLOCK');
  if(running||lastAttempt>=0&&at-lastAttempt<intervalMs)return {status:'SKIPPED',checked:0};
  running=true;lastAttempt=at;
  try{
   const counts={};
   for(const name of new Set(names)){
    let code;
    try{const result=await inspect(name);code=result?.name===name&&CODES.has(result.status)&&result.restoreVerified===false?result.status:'INSPECTION_FAILED';}catch{code='INSPECTION_FAILED';}
    counts[code]=(counts[code]||0)+1;
   }
   for(const [code,count] of Object.entries(counts))if(code!=='RESTORE_VERIFICATION_REQUIRED')await alert({service:'gruk-storage',severity:'warning',code,count,at});
   return {status:'COMPLETED',checked:new Set(names).size,counts,restoreVerified:false};
  }finally{running=false;}
 };
}
module.exports={createBatchRunner};
