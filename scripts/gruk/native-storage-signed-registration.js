'use strict';
const path=require('node:path');
const {createManifest}=require('./drive-backup-manifest');
const {createNativeCatalogInspector}=require('./native-storage-catalog-inspector');
// Register only ciphertext already published in the private native vault.
async function registerNativeArchive({root,name,keyring,privateKey,catalog}){
 if(typeof root!=='string'||!path.isAbsolute(root)||typeof name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(name)||typeof keyring?.sign!=='function'||typeof keyring?.verify!=='function'||typeof catalog?.register!=='function'||typeof catalog?.lookup!=='function')throw Error('NATIVE_REGISTRATION_CONFIG');
 const manifest=await createManifest(path.join(root,name),name);
 const verifyFile=createNativeCatalogInspector({root,catalog:{lookup:async()=>manifest}});
 if((await verifyFile(name)).status!=='RESTORE_VERIFICATION_REQUIRED')throw Error('NATIVE_ARCHIVE_UNVERIFIED');
 const receipt=keyring.sign(manifest,privateKey);
 keyring.verify(receipt,name);
 try{await catalog.register(name,receipt);}catch(e){if(e?.message!=='CATALOG_ALREADY_EXISTS')throw e;}
 const stored=await catalog.lookup(name);
 if(stored.sha256!==manifest.sha256||stored.bytes!==manifest.bytes||stored.name!==name)throw Error('NATIVE_CATALOG_CONFLICT');
 const result=await createNativeCatalogInspector({root,catalog})(name);
 if(result.status!=='RESTORE_VERIFICATION_REQUIRED')throw Error('NATIVE_REGISTRATION_UNVERIFIED');
 return {name,status:'REGISTERED',restoreVerified:false};
}
module.exports={registerNativeArchive};
