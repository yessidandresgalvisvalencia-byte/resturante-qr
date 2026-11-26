'use strict';
const {createPrivateKey,createPublicKey,createHash,sign,verify}=require('node:crypto');
function canonical(m){
 if(!m||Object.keys(m).sort().join(',')!=='bytes,database,name,sha256,version'||m.version!==1||m.database!=='restaurante'||typeof m.name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(m.name)||!Number.isSafeInteger(m.bytes)||m.bytes<64||m.bytes>1073741824||typeof m.sha256!=='string'||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error('SIGNED_MANIFEST_INVALID');
 return Buffer.from(JSON.stringify({version:1,database:m.database,name:m.name,bytes:m.bytes,sha256:m.sha256}));
}
function publicKey(key){
 const k=key?.type==='public'?key:createPublicKey(key);
 if(k.asymmetricKeyType!=='ed25519')throw Error('MANIFEST_KEY_TYPE');
 return k;
}
function keyId(k){return createHash('sha256').update(k.export({type:'spki',format:'der'})).digest('hex');}
function payload(m,id){return Buffer.concat([Buffer.from('GRUK:ENTERPRISE:BACKUP:MANIFEST:V1:'+id+':'),canonical(m)]);}
function signManifest(manifest,key){
 const k=key?.type==='private'?key:createPrivateKey(key);
 if(k.asymmetricKeyType!=='ed25519')throw Error('MANIFEST_KEY_TYPE');
 const id=keyId(publicKey(k));
 return {algorithm:'Ed25519',keyId:id,manifest:JSON.parse(canonical(manifest).toString()),signature:sign(null,payload(manifest,id),k).toString('base64url')};
}
function verifySignedManifest(receipt,trustedKey,expectedName){
 if(!receipt||Object.keys(receipt).sort().join(',')!=='algorithm,keyId,manifest,signature'||receipt.algorithm!=='Ed25519'||typeof expectedName!=='string'||receipt.manifest?.name!==expectedName||typeof receipt.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(receipt.signature))throw Error('SIGNED_MANIFEST_INVALID');
 const k=publicKey(trustedKey),id=keyId(k),sig=Buffer.from(receipt.signature,'base64url');
 if(receipt.keyId!==id||sig.length!==64||sig.toString('base64url')!==receipt.signature||!verify(null,payload(receipt.manifest,id),k,sig))throw Error('SIGNED_MANIFEST_UNTRUSTED');
 return JSON.parse(canonical(receipt.manifest).toString());
}
module.exports={signManifest,verifySignedManifest};
