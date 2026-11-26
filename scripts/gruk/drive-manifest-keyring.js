'use strict';
const {createPublicKey,createHash}=require('node:crypto');
const {signManifest,verifySignedManifest}=require('./drive-manifest-signature');
function createKeyring(config){
 if(!config||typeof config.activeKeyId!=='string'||!Array.isArray(config.keys)||config.keys.length<1||config.keys.length>32)throw Error('KEYRING_INVALID');
 const activeKeyId=config.activeKeyId;
 const keys=new Map();
 for(const entry of config.keys){
  if(!entry||!['active','retired','revoked'].includes(entry.status)||typeof entry.publicKey!=='string'||entry.publicKey.length>2048||!entry.publicKey.startsWith('-----BEGIN PUBLIC KEY-----'))throw Error('KEYRING_INVALID');
  const key=createPublicKey(entry.publicKey);
  if(key.asymmetricKeyType!=='ed25519')throw Error('KEYRING_KEY_TYPE');
  const id=createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
  if(entry.keyId!==id||keys.has(id))throw Error('KEYRING_INVALID');
  keys.set(id,{key,status:entry.status});
 }
 if(keys.get(activeKeyId)?.status!=='active'||[...keys.values()].filter(x=>x.status==='active').length!==1)throw Error('KEYRING_ACTIVE_INVALID');
 return Object.freeze({
  sign(manifest,privateKey){
   const receipt=signManifest(manifest,privateKey);
   if(receipt.keyId!==activeKeyId)throw Error('KEYRING_SIGNER_NOT_ACTIVE');
   verifySignedManifest(receipt,keys.get(receipt.keyId).key,manifest.name);
   return receipt;
  },
  verify(receipt,name){
   const entry=keys.get(receipt?.keyId);
   if(!entry||entry.status==='revoked')throw Error('KEYRING_UNTRUSTED');
   return verifySignedManifest(receipt,entry.key,name);
  }
 });
}
module.exports={createKeyring};
