'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generateKeyPairSync,createHash,randomBytes}=require('node:crypto');
const {verifySigner,verifyRecoveryProof}=require('../../scripts/gruk/native-storage-key-readiness');
test('active Ed25519 signer must match trusted keyring and never returns private material',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const pem=privateKey.export({format:'pem',type:'pkcs8'});
 const keyId=createHash('sha256').update(publicKey.export({format:'der',type:'spki'})).digest('hex');
 const keyring={activeKeyId:keyId,keys:[{keyId,status:'active',publicKey:publicKey.export({format:'pem',type:'spki'})}]};
 assert.deepEqual(verifySigner({privateKey:pem,keyring}),{signerVerified:true,keyId,productionCustodyVerified:false});
 const wrong=generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'});
 assert.throws(()=>verifySigner({privateKey:wrong,keyring}),/^Error: SIGNER_READINESS_FAILED$/);
 assert.throws(()=>verifySigner({privateKey:'secret invalid input',keyring}),/^Error: SIGNER_READINESS_FAILED$/);
});
test('synthetic recovery proof cannot certify independent custody',()=>{
 const challenge=randomBytes(32),expectedDigest=createHash('sha256').update(challenge).digest('hex');
 assert.deepEqual(verifyRecoveryProof({challenge,expectedDigest,recovered:Buffer.from(challenge)}),{syntheticRecoveryVerified:true,independentCustodyVerified:false});
 assert.throws(()=>verifyRecoveryProof({challenge,expectedDigest,recovered:randomBytes(32)}),/RECOVERY_PROOF_FAILED/);
 assert.throws(()=>verifyRecoveryProof({challenge,expectedDigest:'bad',recovered:challenge}),/RECOVERY_PROOF_FAILED/);
});
