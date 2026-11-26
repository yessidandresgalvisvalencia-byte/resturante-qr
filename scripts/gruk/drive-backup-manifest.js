'use strict';
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const {createHash}=require('node:crypto');
const namePattern=/^gruk-restaurante-[0-9]+-[0-9]+\.archive\.age$/;
async function fingerprint(file){
 const h=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const st=await h.stat();
  if(!st.isFile()||st.size<64||st.size>1073741824)throw Error('MANIFEST_INVALID_ARCHIVE');
  const hash=createHash('sha256');let bytes=0;
  for await(const chunk of h.createReadStream({autoClose:false})){
   bytes+=chunk.length;if(bytes>st.size)throw Error('MANIFEST_SIZE_CHANGED');
   hash.update(chunk);
  }
  if(bytes!==st.size)throw Error('MANIFEST_SIZE_CHANGED');
  return {bytes,sha256:hash.digest('hex')};
 }finally{await h.close();}
}
async function createManifest(file,name){
 if(typeof name!=='string'||!namePattern.test(name))throw Error('MANIFEST_INVALID_NAME');
 return {version:1,database:'restaurante',name,...await fingerprint(file)};
}
async function verifyManifest(file,manifest,name){
 if(!manifest||manifest.version!==1||manifest.database!=='restaurante'||manifest.name!==name||!namePattern.test(name)||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<64||manifest.bytes>1073741824||typeof manifest.sha256!=='string'||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw Error('MANIFEST_INVALID');
 const actual=await fingerprint(file);
 if(actual.bytes!==manifest.bytes||actual.sha256!==manifest.sha256)throw Error('MANIFEST_INTEGRITY_MISMATCH');
 return true;
}
async function main(){
 const [,,mode,file,name,receipt]=process.argv;
 if(!file||!name||!receipt)throw Error('MANIFEST_ARGS');
 if(mode==='create'){
  const manifest=await createManifest(file,name);
  await fs.writeFile(receipt,JSON.stringify(manifest)+'\n',{flag:'wx',mode:0o600});
 }else if(mode==='verify'){
  const h=await fs.open(receipt,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  let manifest;
  try{const s=await h.stat();if(!s.isFile()||s.size>4096||(s.mode&0o077))throw Error('MANIFEST_INVALID');manifest=JSON.parse(await h.readFile('utf8'));}finally{await h.close();}
  await verifyManifest(file,manifest,name);
 }else throw Error('MANIFEST_ARGS');
}
if(require.main===module)main().catch(()=>{console.error('GRUK_MANIFEST_CHECK_FAILED');process.exitCode=1;});
module.exports={createManifest,verifyManifest};
