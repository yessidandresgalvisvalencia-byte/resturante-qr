'use strict';
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const {createPrivateKey,createPublicKey}=require('node:crypto');
const {createManifest,verifyManifest}=require('./drive-backup-manifest');
const {signManifest,verifySignedManifest}=require('./drive-manifest-signature');
async function readReceipt(path){
 const h=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const st=await h.stat();
  if(!st.isFile()||st.size<1||st.size>4096||(st.mode&0o077)!==0)throw Error('RECEIPT_INVALID_FILE');
  return JSON.parse(await h.readFile('utf8'));
 }finally{await h.close();}
}
async function createReceipt(file,name,path,{privateKey,trustedKey}){
 const receipt=signManifest(await createManifest(file,name),privateKey);
 verifySignedManifest(receipt,trustedKey,name);
 await fs.writeFile(path,JSON.stringify(receipt)+'\n',{flag:'wx',mode:0o600});
}
async function verifyReceipt(file,name,path,trustedKey){
 return verifyManifest(file,verifySignedManifest(await readReceipt(path),trustedKey,name),name);
}
async function main(){
 const [,,mode,file,name,path]=process.argv;
 if(!file||!name||!path||!process.env.GRUK_MANIFEST_TRUSTED_PUBLIC_KEY)throw Error('RECEIPT_CONFIG');
 const trustedKey=createPublicKey(process.env.GRUK_MANIFEST_TRUSTED_PUBLIC_KEY);
 if(mode==='create'){
  if(!process.env.GRUK_MANIFEST_SIGNING_PRIVATE_KEY)throw Error('RECEIPT_CONFIG');
  await createReceipt(file,name,path,{privateKey:createPrivateKey(process.env.GRUK_MANIFEST_SIGNING_PRIVATE_KEY),trustedKey});
 }else if(mode==='verify')await verifyReceipt(file,name,path,trustedKey);
 else throw Error('RECEIPT_ARGS');
}
if(require.main===module)main().catch(()=>{console.error('GRUK_SIGNED_RECEIPT_FAILED');process.exitCode=1;});
module.exports={createReceipt,verifyReceipt};
