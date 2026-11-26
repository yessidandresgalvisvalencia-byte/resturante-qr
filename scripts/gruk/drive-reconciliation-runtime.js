'use strict';
const {createDriveInspector}=require('./drive-remote-inspector');
const {reconcileBackup}=require('./drive-backup-reconciliation');
const {createCatalog}=require('./drive-backup-catalog');
const {createKeyring}=require('./drive-manifest-keyring');
const {withCatalogStore,validateCatalogConnection}=require('./drive-catalog-connection');
async function getToken(env,fetchImpl){
 const keys=['GRUK_DRIVE_OAUTH_CLIENT_ID','GRUK_DRIVE_OAUTH_CLIENT_SECRET','GRUK_DRIVE_OAUTH_REFRESH_TOKEN'];
 if(keys.some(k=>typeof env[k]!=='string'||!env[k]))throw Error('RECONCILIATION_OAUTH_CONFIG');
 const res=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env[keys[0]],client_secret:env[keys[1]],refresh_token:env[keys[2]],grant_type:'refresh_token'})});
 if(!res.ok)throw Error('RECONCILIATION_OAUTH_FAILED');
 const body=await res.json();
 if(typeof body.access_token!=='string'||!body.access_token||body.token_type?.toLowerCase()!=='bearer')throw Error('RECONCILIATION_OAUTH_FAILED');
 return body.access_token;
}
async function runReconciliation({name,env=process.env,connect,fetchImpl=fetch,alert,now=Date.now}){
 if(env.GRUK_CATALOG_ENABLED!=='true'||env.GRUK_RECONCILIATION_ENABLED!=='true'||typeof name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(name)||typeof alert!=='function'||typeof connect!=='function')throw Error('RECONCILIATION_DISABLED');
 const raw=env.GRUK_MANIFEST_TRUSTED_KEYRING;
 if(typeof raw!=='string'||raw.length>70000)throw Error('RECONCILIATION_KEYRING_CONFIG');
 const keyring=createKeyring(JSON.parse(raw));
 const config={catalogUri:env.GRUK_CATALOG_MONGO_URI,sourceUri:env.GRUK_ENTERPRISE_BACKUP_URI,expectedHost:env.GRUK_CATALOG_EXPECTED_HOST};
 validateCatalogConnection(config);
 let result;
 try{
  result=await withCatalogStore(config,async store=>{
   const catalog=createCatalog({keyring,store});
   return reconcileBackup({name,catalog,inspectRemote:async n=>{
    const token=await getToken(env,fetchImpl);
    return createDriveInspector({folder:env.GRUK_DRIVE_BACKUP_FOLDER_ID,token,fetchImpl})(n);
   }});
  },{connect});
 }catch{result={name,status:'CATALOG_UNVERIFIED',restoreVerified:false};}
 // Only bounded status codes and time are emitted; no archive names, tokens or URI.
 if(result.status!=='RESTORE_VERIFICATION_REQUIRED')await alert({service:'gruk-storage',severity:'warning',code:result.status,at:now()});
 return result;
}
async function main(){
 const [,,name]=process.argv;
 const connect=async(uri,options)=>{
  const c=require('mongoose').createConnection(uri,options);
  try{return await c.asPromise();}catch(error){await c.close().catch(()=>{});throw error;}
 };
 const result=await runReconciliation({name,connect,alert:async event=>{
  await new Promise((resolve,reject)=>process.stderr.write(JSON.stringify(event)+'\n',e=>e?reject(Error('ALERT_DELIVERY_FAILED')):resolve()));
 }});
 console.log(JSON.stringify({status:result.status,restoreVerified:false}));
 if(result.status!=='RESTORE_VERIFICATION_REQUIRED')process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error('GRUK_RECONCILIATION_FAILED');process.exitCode=1;});
module.exports={runReconciliation};
