'use strict';
const {validateVaultUri}=require('./native-storage-mongo-vault-connection');
const {CAP,CHUNK}=require('./native-storage-mongo-vault');
function validateSource(env){
 const raw=env.GRUK_ENTERPRISE_BACKUP_URI,host=env.GRUK_ENTERPRISE_BACKUP_EXPECTED_HOST;
 let u;try{if(typeof raw!=='string'||raw.length>8192)throw Error();u=new URL(raw);}catch{throw Error('SOURCE_ENDPOINT');}
 if(u.protocol!=='mongodb+srv:'||typeof host!=='string'||!host.endsWith('.mongodb.net')||u.hostname!==host||u.hostname===env.GRUK_VAULT_EXPECTED_HOST||u.pathname!=='/restaurante'||u.username!=='gruk_enterprise_backup_reader'||!u.password||u.port||u.hash)throw Error('SOURCE_SCOPE');
 const seen=new Set();
 for(const [key,val] of u.searchParams){const k=key.toLowerCase();if(seen.has(k)||!['authsource','tls','retrywrites','w','appname'].includes(k)||(k==='tls'&&val!=='true')||(k==='authsource'&&val!=='admin'))throw Error('SOURCE_OPTIONS');seen.add(k);}
}
function checkIdentity(status){
 const a=status?.authInfo;
 if(!Array.isArray(a?.authenticatedUsers)||a.authenticatedUsers.length!==1||a.authenticatedUsers[0].user!=='gruk_enterprise_backup_reader'||a.authenticatedUsers[0].db!=='admin'||!Array.isArray(a.authenticatedUserRoles)||a.authenticatedUserRoles.length!==1||a.authenticatedUserRoles[0].role!=='read'||a.authenticatedUserRoles[0].db!=='restaurante')throw Error('SOURCE_ROLE_SCOPE');
}
function capacity(stats,q){
 if(!Number.isSafeInteger(stats?.dataSize)||stats.dataSize<0||!Number.isSafeInteger(stats.indexSize)||stats.indexSize<0||!Number.isSafeInteger(q?.used)||q.used<0||q.used>CAP)throw Error('CAPACITY_UNVERIFIED');
 // Conservative screening estimate only, not a guarantee of compressed archive size or Atlas physical free space.
 const estimated=Math.max(1024*1024,2*(stats.dataSize+stats.indexSize)+1024*1024);
 const accounted=estimated+4096*Math.ceil(estimated/CHUNK)+8192;
 return {estimatedArchiveBytes:estimated,internalRemainingBytes:CAP-q.used,internalCapacityScreenPassed:Number.isSafeInteger(accounted)&&accounted<=CAP-q.used,atlasPhysicalCapacityVerified:false};
}
async function preflight({env=process.env,connect}){
 if(env.GRUK_STORAGE_PREFLIGHT_ENABLED!=='true'||env.GRUK_NATIVE_REAL_BACKUP_ENABLED!=='false'||typeof connect!=='function')throw Error('PREFLIGHT_DISABLED');
 validateSource(env);validateVaultUri(env.GRUK_VAULT_MONGO_URI,env.GRUK_VAULT_EXPECTED_HOST);
 const opts={tls:true,serverSelectionTimeoutMS:10000,maxPoolSize:1};
 const source=await connect(env.GRUK_ENTERPRISE_BACKUP_URI,{...opts,dbName:'restaurante'});
 try{
  if(source.db.databaseName!=='restaurante')throw Error('SOURCE_SCOPE');
  checkIdentity(await source.db.command({connectionStatus:1}));
  const stats=await source.db.command({dbStats:1,scale:1});
  const vault=await connect(env.GRUK_VAULT_MONGO_URI,{...opts,dbName:'gruk_storage_vault'});
  try{
   if(vault.db.databaseName!=='gruk_storage_vault')throw Error('VAULT_SCOPE');
   const quota=await vault.db.collection('vault_quota').findOne({_id:'enterprise'},{projection:{used:1}});
   return {status:'READ_ONLY_PREFLIGHT',sourceRoleVerified:true,...capacity(stats,quota),realBackupEnabled:false,restoreVerified:false};
  }finally{await vault.close();}
 }finally{await source.close();}
}
if(require.main===module)preflight({connect:async(uri,opts)=>{const c=require('mongoose').createConnection(uri,opts);try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}}}).then(x=>console.log(JSON.stringify(x))).catch(e=>{const safe=['PREFLIGHT_DISABLED','SOURCE_ENDPOINT','SOURCE_SCOPE','SOURCE_OPTIONS','SOURCE_ROLE_SCOPE','VAULT_SCOPE','VAULT_ENDPOINT','VAULT_ENDPOINT_SCOPE','VAULT_ENDPOINT_OPTIONS','CAPACITY_UNVERIFIED'];console.error('GRUK_STORAGE_PREFLIGHT_FAILED',safe.includes(e.message)?e.message:'CONNECTION_OR_PERMISSION_FAILURE');process.exitCode=1;});
module.exports={validateSource,checkIdentity,capacity,preflight};
