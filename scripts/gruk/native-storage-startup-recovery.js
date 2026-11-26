'use strict';
const fs=require('node:fs/promises');
const {inspectRecovery}=require('./native-storage-recovery');
const {acquire}=require('./native-storage-lock');
const {recoverReceipt}=require('./native-storage-receipt-recovery');
const {createKeyring}=require('./drive-manifest-keyring');
const {createCatalog}=require('./drive-backup-catalog');
const {validateCatalogConnection,withCatalogStore}=require('./drive-catalog-connection');
const NAME=/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/;
async function recoverStartup({root,keyring,catalog,maxItems=100}){
 if(!Number.isSafeInteger(maxItems)||maxItems<1||maxItems>1000)throw Error('RECOVERY_LIMIT');
 if((await inspectRecovery(root)).status!=='clear')throw Error('RECOVERY_REVIEW_REQUIRED');
 const release=await acquire(root);
 if(!release)throw Error('RECOVERY_LOCKED');
 try{
  const entries=await fs.readdir(root);
  const names=entries.filter(n=>NAME.test(n)).sort();
  const receipts=entries.filter(n=>n.endsWith('.receipt.json'));
  if(names.length>maxItems||receipts.length>maxItems)throw Error('RECOVERY_LIMIT');
  if(receipts.some(n=>!names.includes(n.slice(0,-13)))||names.some(n=>!receipts.includes(n+'.receipt.json')))throw Error('RECOVERY_UNPAIRED');
  let checked=0;
  for(const name of names){await recoverReceipt({root,name,keyring,catalog});checked++;}
  return {status:'COMPLETED',checked,restoreVerified:false};
 }finally{await release();}
}
async function runStartupRecovery({env,connect}){
 if(env.GRUK_NATIVE_STARTUP_RECOVERY_ENABLED!=='true'||env.GRUK_CATALOG_ENABLED!=='true')throw Error('STARTUP_RECOVERY_DISABLED');
 const raw=env.GRUK_MANIFEST_TRUSTED_KEYRING;
 if(typeof raw!=='string'||raw.length>70000)throw Error('RECOVERY_KEYRING');
 const keyring=createKeyring(JSON.parse(raw));
 const config={catalogUri:env.GRUK_CATALOG_MONGO_URI,sourceUri:env.GRUK_ENTERPRISE_BACKUP_URI,expectedHost:env.GRUK_CATALOG_EXPECTED_HOST};
 validateCatalogConnection(config);
 return withCatalogStore(config,store=>recoverStartup({root:env.GRUK_NATIVE_BACKUP_ROOT,keyring,catalog:createCatalog({keyring,store})}),{connect});
}
module.exports={recoverStartup,runStartupRecovery};
