'use strict';
const {createPrivateKey,createPublicKey,createHash,randomBytes}=require('node:crypto');
const {createKeyring}=require('./drive-manifest-keyring');
// Only public metadata is returned. No key generation or customer data access.
function verifySigner({privateKey,keyring}){
 try{
  const k=createPrivateKey(privateKey);
  if(k.asymmetricKeyType!=='ed25519')throw Error();
  const ring=createKeyring(keyring);
  const fixture=randomBytes(128);
  const manifest={version:1,database:'restaurante',name:'gruk-restaurante-1-1.archive.age',bytes:fixture.length,sha256:createHash('sha256').update(fixture).digest('hex')};
  const receipt=ring.sign(manifest,k);
  ring.verify(receipt,manifest.name);
  return {signerVerified:true,keyId:receipt.keyId,productionCustodyVerified:false};
 }catch{throw Error('SIGNER_READINESS_FAILED');}
}
function verifyRecoveryProof({challenge,expectedDigest,recovered}){
 if(!Buffer.isBuffer(challenge)||challenge.length!==32||!Buffer.isBuffer(recovered)||!recovered.equals(challenge)||typeof expectedDigest!=='string'||createHash('sha256').update(challenge).digest('hex')!==expectedDigest)throw Error('RECOVERY_PROOF_FAILED');
 return {syntheticRecoveryVerified:true,independentCustodyVerified:false};
}
module.exports={verifySigner,verifyRecoveryProof};
