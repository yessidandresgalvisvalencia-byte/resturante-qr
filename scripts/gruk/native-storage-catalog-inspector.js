'use strict';
// Read-only native vault reconciliation against the independently signed catalog.
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
function createNativeCatalogInspector({root,catalog}){
 if(typeof root!=='string'||!path.isAbsolute(root)||root===path.parse(root).root||typeof catalog?.lookup!=='function')throw Error('NATIVE_INSPECTOR_CONFIG');
 return async function inspect(name){
  if(typeof name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(name))throw Error('NATIVE_INSPECTOR_NAME');
  const result=status=>({name,status,restoreVerified:false});
  let manifest;
  try{manifest=await catalog.lookup(name);}catch(e){return result(e?.message==='CATALOG_NOT_FOUND'?'CATALOG_MISSING':'CATALOG_UNVERIFIED');}
  if(!manifest||manifest.name!==name||manifest.database!=='restaurante'||manifest.version!==1||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<64||manifest.bytes>1073741824||!/^[a-f0-9]{64}$/.test(manifest.sha256))return result('CATALOG_UNVERIFIED');
  let h;
  try{
   if(await fs.realpath(root)!==root)throw Error('PRIVATE_VOLUME_REQUIRED');
   const dir=await fs.stat(root);
   if(!dir.isDirectory()||(dir.mode&0o077)||dir.uid!==process.getuid())throw Error('PRIVATE_VOLUME_REQUIRED');
   try{h=await fs.open(path.join(root,name),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);}catch(e){if(e.code==='ENOENT')return result('ARCHIVE_MISSING');throw e;}
   const st=await h.stat();
   if(!st.isFile()||(st.mode&0o077)||st.uid!==process.getuid()||st.nlink!==1)return result('ARCHIVE_UNVERIFIED');
   if(st.size!==manifest.bytes)return result('ARCHIVE_SIZE_MISMATCH');
   const header=Buffer.alloc(22);
   await h.read(header,0,22,0);
   if(header.toString()!=='age-encryption.org/v1\n')return result('ARCHIVE_UNVERIFIED');
   const hash=createHash('sha256');let bytes=0;
   for await(const chunk of h.createReadStream({start:0,autoClose:false})){
    bytes+=chunk.length;if(bytes>st.size)return result('ARCHIVE_SIZE_MISMATCH');hash.update(chunk);
   }
   const after=await h.stat();
   if(bytes!==st.size||after.size!==st.size||after.mtimeMs!==st.mtimeMs||after.ctimeMs!==st.ctimeMs)return result('ARCHIVE_UNVERIFIED');
   if(hash.digest('hex')!==manifest.sha256)return result('ARCHIVE_DIGEST_MISMATCH');
   return result('RESTORE_VERIFICATION_REQUIRED');
  }catch{return result('VAULT_UNVERIFIED');}
  finally{if(h)await h.close();}
 };
}
module.exports={createNativeCatalogInspector};
