'use strict';
const {preflight}=require('../../scripts/gruk/native-storage-real-preflight');
let attempted=false;
async function open(uri,opts){
 const c=require('mongoose').createConnection(uri,opts);
 try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}
}
async function runStartupReadiness({env=process.env,connect=open,log=console.log,now=Date.now}={}){
 if(env.GRUK_STORAGE_STARTUP_READINESS!=='true')return;
 if(attempted)return;
 const expires=Date.parse(env.GRUK_STORAGE_STARTUP_READINESS_EXPIRES_AT||'');
 const remaining=expires-now();
 if(!Number.isFinite(remaining)||remaining<=0||remaining>3600000||
 env.GRUK_NATIVE_REAL_BACKUP_ENABLED!=='false'||env.GRUK_STORAGE_PREFLIGHT_ENABLED!=='true'||
 env.GRUK_VAULT_STARTUP_PROBE==='true'||env.GRUK_VAULT_STARTUP_WRITE_PROBE==='true'){
  log('GRUK_STORAGE_STARTUP_READINESS_BLOCKED');return;
 }
 attempted=true;
 try{
  const x=await preflight({env,connect});
  log('GRUK_STORAGE_STARTUP_READINESS_RESULT '+JSON.stringify(x));
 }catch(e){
  const safe=/^(?:SOURCE_CONNECT|SOURCE_IDENTITY_READ|SOURCE_STATS_READ|VAULT_CONNECT|VAULT_QUOTA_READ)_(?:AUTHENTICATION|PERMISSION|NETWORK_OR_TLS|OTHER)$/;
  const fixed=['PREFLIGHT_DISABLED','SOURCE_ENDPOINT','SOURCE_SCOPE','SOURCE_OPTIONS','SOURCE_ROLE_SCOPE','VAULT_SCOPE','VAULT_ENDPOINT','VAULT_ENDPOINT_SCOPE','VAULT_ENDPOINT_OPTIONS','CAPACITY_UNVERIFIED'];
  const msg=typeof e?.message==='string'?e.message:'';
  log('GRUK_STORAGE_STARTUP_READINESS_FAILED '+(fixed.includes(msg)||safe.test(msg)?msg:'UNCLASSIFIED'));
 }
}
module.exports={runStartupReadiness};
