'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {generateKeyPairSync,createHash}=require('node:crypto');
const {createKeyring}=require('../../scripts/gruk/drive-manifest-keyring');
const {createKeyringReceipt,verifyKeyringReceipt}=require('../../scripts/gruk/drive-signed-receipt');
function pair(status){
 const p=generateKeyPairSync('ed25519');
 return {...p,entry:{status,keyId:createHash('sha256').update(p.publicKey.export({type:'spki',format:'der'})).digest('hex'),publicKey:p.publicKey.export({type:'spki',format:'pem'})}};
}
test('receipt files survive key rotation and reject revoked keys',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gruk-keyring-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'a.age'),receipt=path.join(dir,'receipt.json'),name='gruk-restaurante-1-1.archive.age';
 await fs.writeFile(file,Buffer.alloc(100,1));
 const a=pair('active'),b=pair('active');
 const initial=createKeyring({activeKeyId:a.entry.keyId,keys:[a.entry]});
 await createKeyringReceipt(file,name,receipt,initial,a.privateKey);
 const rotated=createKeyring({activeKeyId:b.entry.keyId,keys:[{...a.entry,status:'retired'},b.entry]});
 assert.equal(await verifyKeyringReceipt(file,name,receipt,rotated),true);
 await assert.rejects(createKeyringReceipt(file,name,receipt+'.new',rotated,a.privateKey),/KEYRING_SIGNER_NOT_ACTIVE/);
 const revoked=createKeyring({activeKeyId:b.entry.keyId,keys:[{...a.entry,status:'revoked'},b.entry]});
 await assert.rejects(verifyKeyringReceipt(file,name,receipt,revoked),/KEYRING_UNTRUSTED/);
});
