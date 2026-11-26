'use strict';
const {runCoordinated}=require('./drive-reconciliation-coordinated');
async function runJob({env=process.env,connect,fetchImpl=fetch,alert,now=Date.now,run=runCoordinated}={}){
 if(env.GRUK_INSPECTION_JOB_ENABLED!=='true'||env.GRUK_COORDINATED_INSPECTION_ENABLED!=='true'||env.GRUK_RECONCILIATION_ENABLED!=='true'||env.GRUK_CATALOG_ENABLED!=='true')throw Error('INSPECTION_JOB_DISABLED');
 const raw=env.GRUK_INSPECTION_ARCHIVES;
 if(typeof raw!=='string'||raw.length>1500)throw Error('INSPECTION_JOB_INPUT');
 const names=JSON.parse(raw);
 if(!Array.isArray(names)||!names.length||names.length>10||names.some(n=>typeof n!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(n)))throw Error('INSPECTION_JOB_INPUT');
 const result=await run({names:[...new Set(names)],env,connect,fetchImpl,alert,now});
 if(result?.status==='SKIPPED')return {status:'SKIPPED',checked:0,restoreVerified:false};
 if(result?.status!=='COMPLETED'||!Number.isSafeInteger(result.checked)||result.checked<1||result.checked>10||result.restoreVerified!==false)throw Error('INSPECTION_JOB_RESULT');
 const counts=result.counts;
 if(!counts||Object.values(counts).some(n=>!Number.isSafeInteger(n)||n<1)||Object.values(counts).reduce((a,b)=>a+b,0)!==result.checked)throw Error('INSPECTION_JOB_RESULT');
 return {status:counts.RESTORE_VERIFICATION_REQUIRED===result.checked?'METADATA_MATCH':'ANOMALIES',checked:result.checked,restoreVerified:false};
}
async function main(){
 const connect=async(uri,opts)=>{
  const c=require('mongoose').createConnection(uri,opts);
  try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}
 };
 const alert=event=>new Promise((resolve,reject)=>process.stderr.write(JSON.stringify(event)+'\n',e=>e?reject(Error('ALERT_DELIVERY_FAILED')):resolve()));
 const result=await runJob({connect,alert});
 console.log(JSON.stringify(result));
 if(result.status==='ANOMALIES')process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error('GRUK_INSPECTION_JOB_FAILED');process.exitCode=1;});
module.exports={runJob};
