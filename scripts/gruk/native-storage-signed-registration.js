'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createManifest}=require('./drive-backup-manifest');
const {persistReceipt,recoverReceipt}=require('./native-storage-receipt-recovery');
const {createNativeCatalogInspector}=require('./native-storage-catalog-inspector');
async function prepareNativeReceipt({root,name,keyring,privateKey}){
 if(typeof root!=='string'||!path.isAbsolute(root)||typeof name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(name)||typeof keyring?.sign!=='function'||typeof keyring?.verify!=='function')throw Error('NATIVE_REGISTRATION_CONFIG');
 // Existing evidence must never be replaced or re-signed.
 try{await fs.lstat(path.join(root,name+'.receipt.json'));return;}catch(e){if(e.code!=='ENOENT')throw e;}
 const manifest=await createManifest(path.join(root,name),name);
 const check=createNativeCatalogInspector({root,catalog:{lookup:async()=>manifest}});
 if((await check(name)).status!=='RESTORE_VERIFICATION_REQUIRED')throw Error('NATIVE_ARCHIVE_UNVERIFIED');
 const receipt=keyring.sign(manifest,privateKey);
 try{await persistReceipt({root,name,keyring,receipt});}catch(e){if(e.code!=='EEXIST')throw e;}
}
async function registerNativeArchive(args){
 await prepareNativeReceipt(args);
 return recoverReceipt(args);
}
module.exports={registerNativeArchive,prepareNativeReceipt};
