'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const {randomUUID}=require('node:crypto');
const {createNativeCatalogInspector}=require('./native-storage-catalog-inspector');
const NAME=/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/;
async function privateRoot(root){
 if(typeof root!=='string'||!path.isAbsolute(root)||root===path.parse(root).root||await fs.realpath(root)!==root)throw Error('RECOVERY_ROOT');
 const st=await fs.stat(root);
 if(!st.isDirectory()||(st.mode&0o077)||st.uid!==process.getuid())throw Error('RECOVERY_ROOT');
}
async function persistReceipt({root,name,receipt,keyring}){
 if(!NAME.test(name)||typeof name!=='string')throw Error('RECOVERY_NAME');
 await privateRoot(root);
 const manifest=keyring.verify(receipt,name);
 const check=createNativeCatalogInspector({root,catalog:{lookup:async()=>manifest}});
 if((await check(name)).status!=='RESTORE_VERIFICATION_REQUIRED')throw Error('RECOVERY_ARCHIVE_UNVERIFIED');
 const data=JSON.stringify(receipt);
 if(Buffer.byteLength(data)>4096)throw Error('RECOVERY_RECEIPT');
 const dest=path.join(root,name+'.receipt.json'),tmp=path.join(root,'.receipt-pending-'+randomUUID());
 try{
  const h=await fs.open(tmp,'wx',0o600);
  try{await h.writeFile(data);await h.sync();}finally{await h.close();}
  await fs.link(tmp,dest);
  const d=await fs.open(root,'r');try{await d.sync();}finally{await d.close();}
 }finally{await fs.unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function readNativeReceipt({root,name,keyring}){
 if(typeof name!=='string'||!NAME.test(name))throw Error('RECOVERY_NAME');
 await privateRoot(root);
 const h=await fs.open(path.join(root,name+'.receipt.json'),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 let receipt;
 try{
  const st=await h.stat();
  if(!st.isFile()||st.uid!==process.getuid()||(st.mode&0o077)||st.nlink!==1||st.size<1||st.size>4096)throw Error('RECOVERY_RECEIPT');
  receipt=JSON.parse(await h.readFile('utf8'));
 }finally{await h.close();}
 const manifest=keyring.verify(receipt,name);
 const check=createNativeCatalogInspector({root,catalog:{lookup:async()=>manifest}});
 if((await check(name)).status!=='RESTORE_VERIFICATION_REQUIRED')throw Error('RECOVERY_ARCHIVE_UNVERIFIED');
 return {receipt,manifest};
}
async function recoverReceipt({root,name,keyring,catalog}){
 const {receipt,manifest}=await readNativeReceipt({root,name,keyring});
 try{await catalog.register(name,receipt);}catch(e){if(e?.message!=='CATALOG_ALREADY_EXISTS')throw e;}
 const stored=await catalog.lookup(name);
 if(stored.name!==name||stored.sha256!==manifest.sha256||stored.bytes!==manifest.bytes)throw Error('RECOVERY_CONFLICT');
 return {name,status:'REGISTERED',restoreVerified:false};
}
module.exports={persistReceipt,recoverReceipt,readNativeReceipt};
