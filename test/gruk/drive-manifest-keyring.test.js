'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,createHash}=require('node:crypto');
const {createKeyring}=require('../../scripts/gruk/drive-manifest-keyring');
function pair(status){
 const p=generateKeyPairSync('ed25519');
 return {...p,entry:{status,keyId:createHash('sha256').update(p.publicKey.export({type:'spki',format:'der'})).digest('hex'),publicKey:p.publicKey.export({type:'spki',format:'pem'})}};
}
test('rotation retains historical verification but blocks retired or revoked signing',()=>{
 const a=pair('active'),b=pair('active');
 const m={version:1,database:'restaurante',name:'gruk-restaurante-1-1.archive.age',bytes:100,sha256:'a'.repeat(64)};
 const first=createKeyring({activeKeyId:a.entry.keyId,keys:[a.entry]});
 const old=first.sign(m,a.privateKey);
 const config={activeKeyId:b.entry.keyId,keys:[{...a.entry,status:'retired'},b.entry]};
 const next=createKeyring(config);
 assert.deepEqual(next.verify(old,m.name),m);
 assert.throws(()=>next.sign(m,a.privateKey),/KEYRING_SIGNER_NOT_ACTIVE/);
 assert.deepEqual(next.verify(next.sign(m,b.privateKey),m.name),m);
 config.activeKeyId=a.entry.keyId;
 assert.throws(()=>next.sign(m,a.privateKey),/KEYRING_SIGNER_NOT_ACTIVE/);
 const revoked=createKeyring({activeKeyId:b.entry.keyId,keys:[{...a.entry,status:'revoked'},b.entry]});
 assert.throws(()=>revoked.verify(old,m.name),/KEYRING_UNTRUSTED/);
 assert.throws(()=>createKeyring({activeKeyId:b.entry.keyId,keys:[a.entry,b.entry]}),/KEYRING_ACTIVE_INVALID/);
 assert.throws(()=>createKeyring({activeKeyId:b.entry.keyId,keys:[{...b.entry,keyId:'bad'}]}),/KEYRING_INVALID/);
});
