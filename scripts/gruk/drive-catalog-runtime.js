'use strict';
const {withCatalogStore}=require('./drive-catalog-connection');
const {createCatalog}=require('./drive-backup-catalog');
const {createKeyring}=require('./drive-manifest-keyring');
const {readReceipt}=require('./drive-signed-receipt');
const {verifyManifest}=require('./drive-backup-manifest');
async function runCatalog({mode,file,name,receiptPath,env=process.env,connect}){
 if(!['register','verify'].includes(mode)||!file||!name||!receiptPath||env.GRUK_CATALOG_ENABLED!=='true')throw Error('CATALOG_RUNTIME_DISABLED');
 const raw=env.GRUK_MANIFEST_TRUSTED_KEYRING;
 if(typeof raw!=='string'||raw.length>70000)throw Error('CATALOG_KEYRING_CONFIG');
 const keyring=createKeyring(JSON.parse(raw));
 const receipt=await readReceipt(receiptPath);
 const manifest=keyring.verify(receipt,name);
 await verifyManifest(file,manifest,name);
 const config={catalogUri:env.GRUK_CATALOG_MONGO_URI,sourceUri:env.GRUK_ENTERPRISE_BACKUP_URI,expectedHost:env.GRUK_CATALOG_EXPECTED_HOST};
 return withCatalogStore(config,async store=>{
  const catalog=createCatalog({keyring,store});
  if(mode==='register')await catalog.register(name,receipt);
  const stored=await catalog.lookup(name);
  if(stored.sha256!==manifest.sha256||stored.bytes!==manifest.bytes)throw Error('CATALOG_RECEIPT_MISMATCH');
  return stored;
 },{connect});
}
async function main(){
 const [,,mode,file,name,receiptPath]=process.argv;
 const connect=async(uri,options)=>{
  const connection=require('mongoose').createConnection(uri,options);
  try{return await connection.asPromise();}catch(error){await connection.close().catch(()=>{});throw error;}
 };
 await runCatalog({mode,file,name,receiptPath,connect});
 console.log('GRUK_CATALOG_INTEGRITY_OK');
}
if(require.main===module)main().catch(()=>{console.error('GRUK_CATALOG_OPERATION_FAILED');process.exitCode=1;});
module.exports={runCatalog};
