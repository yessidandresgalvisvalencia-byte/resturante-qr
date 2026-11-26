'use strict';
// Provider-neutral catalog. A receipt proves ciphertext identity, not restoration success.
function createCatalog({keyring,store}){
 if(typeof keyring?.verify!=='function'||typeof store?.putIfAbsent!=='function'||typeof store?.get!=='function')throw Error('CATALOG_CONFIG');
 function nameOf(name){
  if(typeof name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(name))throw Error('CATALOG_NAME');
  return name;
 }
 function validate(entry,name){
  if(!entry||Object.keys(entry).sort().join(',')!=='receipt,version'||entry.version!==1)throw Error('CATALOG_INVALID');
  const manifest=keyring.verify(entry.receipt,name);
  return {manifest,receipt:entry.receipt};
 }
 function decode(raw){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>4096)throw Error('CATALOG_INVALID');
  return JSON.parse(raw);
 }
 return Object.freeze({
  async register(name,receipt){
   nameOf(name);
   const entry={version:1,receipt};
   validate(entry,name);
   const encoded=JSON.stringify(entry);
   if(Buffer.byteLength(encoded)>4096)throw Error('CATALOG_INVALID');
   // Store contract: atomic create-only; never overwrite historical evidence.
   if(await store.putIfAbsent(name,encoded)!==true)throw Error('CATALOG_ALREADY_EXISTS');
   const actual=await store.get(name);
   if(actual!==encoded)throw Error('CATALOG_READBACK_MISMATCH');
   return validate(decode(actual),name).manifest;
  },
  async lookup(name){
   nameOf(name);
   const raw=await store.get(name);
   if(raw===null||raw===undefined)throw Error('CATALOG_NOT_FOUND');
   const {manifest}=validate(decode(raw),name);
   return {...manifest,restoreVerified:false};
  }
 });
}
module.exports={createCatalog};
