'use strict';
const DB='gruk_storage_vault';
function validateVaultUri(uri,host){
 if(typeof uri!=='string'||uri.length>8192||typeof host!=='string'||!host.endsWith('.mongodb.net'))throw Error('VAULT_ENDPOINT');
 let u;try{u=new URL(uri);}catch{throw Error('VAULT_ENDPOINT');}
 if(u.protocol!=='mongodb+srv:'||u.hostname!==host||u.pathname!=='/'+DB||u.username!=='gruk_vault_worker'||!u.password||u.port||u.hash)throw Error('VAULT_ENDPOINT_SCOPE');
 for(const [k,v] of u.searchParams)if(!['retrywrites','w','appname','authsource','tls'].includes(k.toLowerCase())||(k.toLowerCase()==='tls'&&v!=='true'))throw Error('VAULT_ENDPOINT_OPTIONS');
}
async function probeVault({env=process.env,connect}){
 if(env.GRUK_VAULT_PROBE_ENABLED!=='true'||env.GRUK_NATIVE_REAL_BACKUP_ENABLED!=='false'||typeof connect!=='function')throw Error('VAULT_PROBE_DISABLED');
 validateVaultUri(env.GRUK_VAULT_MONGO_URI,env.GRUK_VAULT_EXPECTED_HOST);
 const c=await connect(env.GRUK_VAULT_MONGO_URI,{dbName:DB,tls:true,serverSelectionTimeoutMS:10000,maxPoolSize:1});
 try{
  if(c.db.databaseName!==DB)throw Error('VAULT_SCOPE');
  const q=await c.db.collection('vault_quota').findOne({_id:'enterprise'});
  if(!q||!Number.isSafeInteger(q.used)||q.used<0||q.used>32*1024*1024)throw Error('VAULT_QUOTA_UNVERIFIED');
  await c.db.collection('archives').findOne({_id:'synthetic-connectivity-probe'},{projection:{_id:1}});
  await c.db.collection('archive_chunks').findOne({_id:'synthetic-connectivity-probe'},{projection:{_id:1}});
  return {status:'READ_ACCESS_VERIFIED',used:q.used,realBackupEnabled:false,writePermissionsVerified:false};
 }finally{await c.close();}
}
if(require.main===module)probeVault({connect:async(uri,opts)=>{const c=require('mongoose').createConnection(uri,opts);try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}}}).then(x=>console.log(JSON.stringify(x))).catch(()=>{console.error('GRUK_VAULT_PROBE_FAILED');process.exitCode=1;});
module.exports={validateVaultUri,probeVault};
