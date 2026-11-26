'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync}=require('node:crypto');
const {signManifest,verifySignedManifest}=require('../../scripts/gruk/drive-manifest-signature');
test('signed receipt requires pinned independent public key and exact archive',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const other=generateKeyPairSync('ed25519');
 const m={version:1,database:'restaurante',name:'gruk-restaurante-1-1.archive.age',bytes:100,sha256:'a'.repeat(64)};
 const receipt=signManifest(m,privateKey);
 assert.deepEqual(verifySignedManifest(receipt,publicKey,m.name),m);
 assert.throws(()=>verifySignedManifest(receipt,other.publicKey,m.name),/SIGNED_MANIFEST_UNTRUSTED/);
 assert.throws(()=>verifySignedManifest({...receipt,manifest:{...m,bytes:101}},publicKey,m.name),/SIGNED_MANIFEST_UNTRUSTED/);
 assert.throws(()=>verifySignedManifest(receipt,publicKey,'gruk-restaurante-2-1.archive.age'),/SIGNED_MANIFEST_INVALID/);
 assert.throws(()=>signManifest({...m,database:'personal'},privateKey),/SIGNED_MANIFEST_INVALID/);
 assert.throws(()=>verifySignedManifest({...receipt,publicKey:'untrusted'},publicKey,m.name),/SIGNED_MANIFEST_INVALID/);
});
