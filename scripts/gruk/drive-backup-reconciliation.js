'use strict';
// Read-only reconciliation. Remote metadata is not proof of decryptability.
async function reconcileBackup({name,catalog,inspectRemote}){
 if(typeof name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(name)||typeof catalog?.lookup!=='function'||typeof inspectRemote!=='function')throw Error('RECONCILIATION_CONFIG');
 let manifest;
 try{manifest=await catalog.lookup(name);}catch(error){
  if(error?.message==='CATALOG_NOT_FOUND')return {name,status:'CATALOG_MISSING',restoreVerified:false};
  return {name,status:'CATALOG_UNVERIFIED',restoreVerified:false};
 }
 let objects;
 try{objects=await inspectRemote(name);}catch{return {name,status:'REMOTE_UNAVAILABLE',restoreVerified:false};}
 const result=status=>({name,status,restoreVerified:false});
 if(!Array.isArray(objects)||objects.length>100)return result('REMOTE_UNVERIFIED');
 if(!objects.length)return result('UPLOAD_NOT_CONFIRMED');
 if(objects.length!==1)return result('DUPLICATE_REMOTE_OBJECTS');
 const object=objects[0];
 if(!object||object.name!==name||object.trashed!==false||object.folderVerified!==true||object.mimeType!=='application/octet-stream'||typeof object.size!=='string'||!/^\d{1,16}$/.test(object.size))return result('REMOTE_UNVERIFIED');
 if(Number(object.size)!==manifest.bytes)return result('REMOTE_SIZE_MISMATCH');
 return result('RESTORE_VERIFICATION_REQUIRED');
}
module.exports={reconcileBackup};
