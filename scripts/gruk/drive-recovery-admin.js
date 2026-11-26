'use strict';
const {validateCatalogConnection}=require('./drive-catalog-connection');
const {recoverAtomically}=require('./drive-reconciliation-recovery-transaction');
async function runAdminRecovery({owner,startedAt,evidenceId,approval,env=process.env,connect,now=Date.now}){
 if(env.GRUK_CATALOG_ENABLED!=='true'||env.GRUK_ADMIN_RECOVERY_ENABLED!=='true'||approval!=='CONFIRM_WORKER_TERMINATED'||typeof connect!=='function')throw Error('ADMIN_RECOVERY_DISABLED');
 const at=now();
 if(typeof owner!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(owner)||typeof evidenceId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(evidenceId)||!Number.isSafeInteger(startedAt)||startedAt<0||!Number.isSafeInteger(at)||at-startedAt<3600000||!Number.isSafeInteger(at+86400000))throw Error('ADMIN_RECOVERY_INPUT');
 const config={catalogUri:env.GRUK_CATALOG_ADMIN_URI,sourceUri:env.GRUK_ENTERPRISE_BACKUP_URI,expectedHost:env.GRUK_CATALOG_EXPECTED_HOST};
 validateCatalogConnection(config);
 if(!env.GRUK_CATALOG_MONGO_URI)throw Error('ADMIN_RECOVERY_SEPARATION');
 validateCatalogConnection({...config,catalogUri:env.GRUK_CATALOG_MONGO_URI});
 if(new URL(config.catalogUri).username===new URL(env.GRUK_CATALOG_MONGO_URI).username)throw Error('ADMIN_RECOVERY_SEPARATION');
 const c=await connect(config.catalogUri,{dbName:'gruk_storage_catalog',tls:true,serverSelectionTimeoutMS:10000,maxPoolSize:2});
 try{return await recoverAtomically({client:c.getClient(),db:c.db,owner,startedAt,evidenceId,approval,now:()=>at});}
 finally{await c.close();}
}
async function main(){
 const [,,owner,start,evidenceId,approval]=process.argv;
 if(!/^\d{1,16}$/.test(start||''))throw Error('ADMIN_RECOVERY_INPUT');
 const connect=async(uri,opts)=>{
  const c=require('mongoose').createConnection(uri,opts);
  try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}
 };
 const result=await runAdminRecovery({owner,startedAt:Number(start),evidenceId,approval,connect});
 console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(()=>{console.error('GRUK_ADMIN_RECOVERY_FAILED');process.exitCode=1;});
module.exports={runAdminRecovery};
