'use strict';
const assert=require('node:assert/strict');
const {createHash,generateKeyPairSync}=require('node:crypto');
const {createKeyring}=require('./drive-manifest-keyring');
const {runJob}=require('./drive-reconciliation-job');
const {createCoordinator}=require('./drive-reconciliation-coordinator');
const {recoverAtomically}=require('./drive-reconciliation-recovery-transaction');
async function main(){
 // Hardcoded loopback only. Never accept a URI or production credentials.
 const c=require('mongoose').createConnection('mongodb://127.0.0.1:27189/gruk_storage_catalog?replicaSet=grukci&directConnection=true',{serverSelectionTimeoutMS:15000});
 try{
  await c.asPromise();
  const db=c.db,client=c.getClient();
  const hello=await db.admin().command({hello:1});
  assert.equal(hello.setName,'grukci');
  assert.equal(hello.isWritablePrimary,true);
  const control=db.collection('reconciliation_control'),audit=db.collection('reconciliation_audit');
  await db.createCollection('reconciliation_control');
  await db.createCollection('reconciliation_audit');
  const now=()=>0;
  let count=0;
  const runs=await Promise.all(Array.from({length:8},()=>createCoordinator(db,{now})(async()=>{count++;return 'done';})));
  assert.equal(count,1);
  assert.equal(runs.filter(x=>x==='done').length,1);
  assert.equal(runs.filter(x=>x?.status==='SKIPPED').length,7);
  const owner='12345678-1234-4123-8123-123456789abc',startedAt=0;
  await control.updateOne({_id:'enterprise-reconciliation'},{$set:{active:true,owner,startedAt}});
  const duplicate=createHash('sha256').update(JSON.stringify([owner,'RECOVERY_COMPLETED'])).digest('hex');
  await audit.insertOne({_id:duplicate,synthetic:true});
  const args={client,db,owner,startedAt,approval:'CONFIRM_WORKER_TERMINATED',evidenceId:'synthetic-incident',now:()=>3600000};
  await assert.rejects(recoverAtomically(args),e=>e?.code===11000);
  assert.equal((await control.findOne({_id:'enterprise-reconciliation'})).active,true);
  assert.equal(await audit.countDocuments({}),1);
  await audit.deleteOne({_id:duplicate});
  assert.equal((await recoverAtomically(args)).status,'RECOVERED');
  assert.equal((await control.findOne({_id:'enterprise-reconciliation'})).active,false);
  assert.equal(await audit.countDocuments({}),2);
  // Exercise the complete discovery -> signature -> metadata -> audit -> cursor path.
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const keyId=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
  const config={activeKeyId:keyId,keys:[{keyId,status:'active',publicKey:publicKey.export({type:'spki',format:'pem'})}]};
  const folder='1_1OxE9Ey7kr-GoCjOnC_Elm_sJpTQrfN';
  const names=Array.from({length:11},(_,i)=>'gruk-restaurante-'+String(i+1).padStart(2,'0')+'-1.archive.age');
  await db.createCollection('signed_receipts');
  const keyring=createKeyring(config);
  for(const name of names){
   const receipt=keyring.sign({version:1,database:'restaurante',name,bytes:100,sha256:'a'.repeat(64)},privateKey);
   await db.collection('signed_receipts').insertOne({_id:name,value:JSON.stringify({version:1,receipt})});
  }
  const env={GRUK_INSPECTION_JOB_ENABLED:'true',GRUK_COORDINATED_INSPECTION_ENABLED:'true',GRUK_RECONCILIATION_ENABLED:'true',GRUK_CATALOG_ENABLED:'true',GRUK_INSPECTION_DISCOVERY_ENABLED:'true',GRUK_MANIFEST_TRUSTED_KEYRING:JSON.stringify(config),GRUK_CATALOG_MONGO_URI:'mongodb+srv://catalog:fake@catalog.example.mongodb.net/gruk_storage_catalog',GRUK_ENTERPRISE_BACKUP_URI:'mongodb+srv://source:fake@source.example.mongodb.net/restaurante',GRUK_CATALOG_EXPECTED_HOST:'catalog.example.mongodb.net',GRUK_DRIVE_BACKUP_FOLDER_ID:folder,GRUK_DRIVE_OAUTH_CLIENT_ID:'synthetic',GRUK_DRIVE_OAUTH_CLIENT_SECRET:'synthetic',GRUK_DRIVE_OAUTH_REFRESH_TOKEN:'synthetic'};
  const inspected=[],alerts=[];
  const connect=async uri=>{assert.equal(uri,env.GRUK_CATALOG_MONGO_URI);return {db,async close(){}};};
  const fetchImpl=async(url,options)=>{
   const u=new URL(url);
   if(u.hostname==='oauth2.googleapis.com'){assert.equal(options.method,'POST');return {ok:true,json:async()=>({access_token:'synthetic',token_type:'Bearer'})};}
   assert.equal(u.hostname,'www.googleapis.com');assert.equal(options.method,'GET');
   if(u.pathname.endsWith('/'+folder))return {ok:true,json:async()=>({id:folder,mimeType:'application/vnd.google-apps.folder',trashed:false})};
   const name=names.find(n=>u.searchParams.get('q')?.includes("name = '"+n+"'"));
   assert.ok(name);inspected.push(name);
   const files=name===names[10]?[]:[{id:'synthetic-'+name,name,parents:[folder],mimeType:'application/octet-stream',trashed:false,size:'100'}];
   return {ok:true,json:async()=>({incompleteSearch:false,files})};
  };
  let at=90000000;
  const job={env,connect,fetchImpl,now:()=>at,alert:async e=>alerts.push(e)};
  assert.deepEqual(await runJob(job),{status:'METADATA_MATCH',checked:10,restoreVerified:false});
  assert.equal((await control.findOne({_id:'enterprise-reconciliation'})).cursor,names[9]);
  assert.equal((await runJob(job)).status,'SKIPPED');
  at+=86400000;
  assert.deepEqual(await runJob(job),{status:'ANOMALIES',checked:1,restoreVerified:false});
  assert.equal((await control.findOne({_id:'enterprise-reconciliation'})).cursor,null);
  assert.deepEqual(inspected,names);
  assert.equal(alerts.length,1);assert.equal(alerts[0].code,'UPLOAD_NOT_CONFIRMED');
  assert.equal(await audit.countDocuments({type:'INSPECTION_COMPLETED'}),2);
  console.log('GRUK_CATALOG_REAL_REPLICA_SYNTHETIC_OK');
 }finally{await c.close();}
}
main().catch(()=>{console.error('GRUK_CATALOG_REAL_REPLICA_SYNTHETIC_FAILED');process.exitCode=1;});
