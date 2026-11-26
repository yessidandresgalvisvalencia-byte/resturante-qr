'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,createHash}=require('node:crypto');
const {createKeyring}=require('../../scripts/gruk/drive-manifest-keyring');
const {runReconciliation}=require('../../scripts/gruk/drive-reconciliation-runtime');
test('runtime reconciles through read-only injected connections and emits sanitized alerts',async()=>{
 const name='gruk-restaurante-1-1.archive.age',folder='1_1OxE9Ey7kr-GoCjOnC_Elm_sJpTQrfN';
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const keyId=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
 const config={activeKeyId:keyId,keys:[{keyId,status:'active',publicKey:publicKey.export({type:'spki',format:'pem'})}]};
 const receipt=createKeyring(config).sign({version:1,database:'restaurante',name,bytes:100,sha256:'a'.repeat(64)},privateKey);
 const env={GRUK_CATALOG_ENABLED:'true',GRUK_RECONCILIATION_ENABLED:'true',GRUK_MANIFEST_TRUSTED_KEYRING:JSON.stringify(config),GRUK_CATALOG_MONGO_URI:'mongodb+srv://catalog:fake@catalog.example.mongodb.net/gruk_storage_catalog',GRUK_ENTERPRISE_BACKUP_URI:'mongodb+srv://source:fake@source.example.mongodb.net/restaurante',GRUK_CATALOG_EXPECTED_HOST:'catalog.example.mongodb.net',GRUK_DRIVE_BACKUP_FOLDER_ID:folder,GRUK_DRIVE_OAUTH_CLIENT_ID:'synthetic',GRUK_DRIVE_OAUTH_CLIENT_SECRET:'synthetic',GRUK_DRIVE_OAUTH_REFRESH_TOKEN:'synthetic'};
 let closed=0,connections=0;const alerts=[];
 const connect=async()=>{connections++;return {db:{databaseName:'gruk_storage_catalog',collection(){return {async findOne(){return {_id:name,value:JSON.stringify({version:1,receipt})};}};}},async close(){closed++;}};};
 const fetchImpl=async(url,opts)=>{
  const u=new URL(url);
  if(u.hostname==='oauth2.googleapis.com'){assert.equal(opts.method,'POST');return {ok:true,json:async()=>({access_token:'fake',token_type:'Bearer'})};}
  assert.equal(opts.method,'GET');
  return {ok:true,json:async()=>u.pathname.endsWith(folder)?{id:folder,mimeType:'application/vnd.google-apps.folder',trashed:false}:{incompleteSearch:false,files:[]}};
 };
 const args={name,env,connect,fetchImpl,alert:async e=>alerts.push(e),now:()=>123};
 await assert.rejects(runReconciliation({...args,env:{...env,GRUK_RECONCILIATION_ENABLED:'false'}}),/RECONCILIATION_DISABLED/);
 assert.equal(connections,0);
 assert.equal((await runReconciliation(args)).status,'UPLOAD_NOT_CONFIRMED');
 assert.equal(closed,1);
 assert.deepEqual(alerts,[{service:'gruk-storage',severity:'warning',code:'UPLOAD_NOT_CONFIRMED',at:123}]);
 await assert.rejects(runReconciliation({...args,alert:async()=>{throw Error('sink failure');}}),/sink failure/);
});
