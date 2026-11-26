'use strict';
const {createPrivateKey}=require('node:crypto');
const {createKeyring}=require('./drive-manifest-keyring');
const {createCatalog}=require('./drive-backup-catalog');
const {validateCatalogConnection,withCatalogStore}=require('./drive-catalog-connection');
const {prepareNativeReceipt}=require('./native-storage-signed-registration');
const {recoverReceipt}=require('./native-storage-receipt-recovery');
const {replicateArchive,validateReplicaRoots}=require('./native-storage-replication');
function prepareSignedRegistration(env,connect){
 if(env.GRUK_CATALOG_ENABLED!=='true'||env.GRUK_NATIVE_SIGNED_REGISTRATION_ENABLED!=='true')throw Error('NATIVE_SIGNED_REGISTRATION_DISABLED');
 const raw=env.GRUK_MANIFEST_TRUSTED_KEYRING;
 if(typeof raw!=='string'||raw.length>70000||typeof env.GRUK_MANIFEST_SIGNING_PRIVATE_KEY!=='string'||env.GRUK_MANIFEST_SIGNING_PRIVATE_KEY.length>4096)throw Error('NATIVE_SIGNED_REGISTRATION_CONFIG');
 const keyring=createKeyring(JSON.parse(raw)),privateKey=createPrivateKey(env.GRUK_MANIFEST_SIGNING_PRIVATE_KEY);
 // Verify active signer before starting any backup.
 keyring.sign({version:1,database:'restaurante',name:'gruk-restaurante-0-0.archive.age',bytes:64,sha256:'0'.repeat(64)},privateKey);
 const config={catalogUri:env.GRUK_CATALOG_MONGO_URI,sourceUri:env.GRUK_ENTERPRISE_BACKUP_URI,expectedHost:env.GRUK_CATALOG_EXPECTED_HOST};
 validateCatalogConnection(config);
 if(typeof connect!=='function')throw Error('NATIVE_SIGNED_REGISTRATION_CONFIG');
 const required=env.GRUK_NATIVE_REPLICATION_REQUIRED==='true';
 const roots={sourceRoot:env.GRUK_NATIVE_BACKUP_ROOT,targetRoot:env.GRUK_NATIVE_REPLICA_ROOT};
 if(required&&(!roots.sourceRoot||!roots.targetRoot))throw Error('NATIVE_REPLICATION_CONFIG');
 const register=async name=>{
  const args={root:env.GRUK_NATIVE_BACKUP_ROOT,name,keyring};
  await prepareNativeReceipt({...args,privateKey});
  return withCatalogStore(config,async store=>{
   const catalog=createCatalog({keyring,store});
   const result=await recoverReceipt({...args,catalog});
   if(!required)return result;
   const replica=await replicateArchive({...roots,name,catalog,keyring});
   if(!['REPLICATED','ALREADY_PRESENT'].includes(replica.status)||replica.receiptVerified!==true||replica.distinctDevice!==true||replica.restoreVerified!==false)throw Error('NATIVE_REPLICATION_UNVERIFIED');
   return {...result,replicationVerified:true};
  },{connect});
 };
 register.preflight=async()=>{if(required)await validateReplicaRoots(roots);};
 return register;
}
module.exports={prepareSignedRegistration};
