'use strict';
const {randomUUID}=require('node:crypto');
const {validateVaultUri}=require('./native-storage-mongo-vault-connection');
async function probeWrite({env=process.env,connect}){
 if(env.GRUK_VAULT_WRITE_PROBE_ENABLED!=='true'||env.GRUK_NATIVE_REAL_BACKUP_ENABLED!=='false'||typeof connect!=='function')throw Error('VAULT_WRITE_PROBE_DISABLED');
 validateVaultUri(env.GRUK_VAULT_MONGO_URI,env.GRUK_VAULT_EXPECTED_HOST);
 const c=await connect(env.GRUK_VAULT_MONGO_URI,{dbName:'gruk_storage_vault',tls:true,serverSelectionTimeoutMS:10000,maxPoolSize:1});
 let session;
 try{
  if(c.db.databaseName!=='gruk_storage_vault')throw Error('VAULT_SCOPE');
  const a=c.db.collection('archives'),b=c.db.collection('archive_chunks'),q=c.db.collection('vault_quota');
  const id='synthetic-probe-'+randomUUID();
  session=c.getClient().startSession();
  session.startTransaction({readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
  try{
   const before=await q.findOne({_id:'enterprise'},{session});
   if(!Number.isSafeInteger(before?.used)||before.used<0||before.used>=32*1024*1024)throw Error('VAULT_QUOTA_UNVERIFIED');
   const u=await q.updateOne({_id:'enterprise',used:before.used},{$inc:{used:1}},{session});
   if(u.modifiedCount!==1)throw Error('VAULT_QUOTA_WRITE_UNVERIFIED');
   await a.insertOne({_id:id,synthetic:true},{session});
   await b.insertOne({_id:id,name:id,synthetic:true},{session});
   if(!(await a.findOne({_id:id},{session}))||!(await b.findOne({_id:id},{session}))||(await q.findOne({_id:'enterprise'},{session}))?.used!==before.used+1)throw Error('VAULT_WRITE_UNVERIFIED');
  }finally{await session.abortTransaction();}
  if(await a.findOne({_id:id})||await b.findOne({_id:id}))throw Error('VAULT_PROBE_RESIDUE');
  return {status:'SYNTHETIC_WRITE_ABORT_VERIFIED',realBackupEnabled:false,independentReplica:false};
 }finally{try{if(session)await session.endSession();}finally{await c.close();}}
}
if(require.main===module)probeWrite({connect:async(uri,opts)=>{const c=require('mongoose').createConnection(uri,opts);try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}}}).then(x=>console.log(JSON.stringify(x))).catch(()=>{console.error('GRUK_VAULT_WRITE_PROBE_FAILED');process.exitCode=1;});
module.exports={probeWrite};
