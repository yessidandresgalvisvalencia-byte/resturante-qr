'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {retrieve}=require('./native-backup-storage');
const {createNativeCatalogInspector}=require('./native-storage-catalog-inspector');
const {acquire}=require('./native-storage-lock');
const {readNativeReceipt,persistReceipt}=require('./native-storage-receipt-recovery');
async function verifyRoot(root){
 if(typeof root!=='string'||!path.isAbsolute(root)||root===path.parse(root).root||await fs.realpath(root)!==root)throw Error('REPLICA_ROOT');
 const st=await fs.stat(root);
 if(!st.isDirectory()||(st.mode&0o077)||st.uid!==process.getuid())throw Error('REPLICA_ROOT');
 return st;
}
async function replicateArchive({sourceRoot,targetRoot,name,catalog,keyring,requireDistinctDevice=true}){
 const source=await verifyRoot(sourceRoot),target=await verifyRoot(targetRoot);
 if(sourceRoot===targetRoot||sourceRoot.startsWith(targetRoot+'/')||targetRoot.startsWith(sourceRoot+'/')||(source.dev===target.dev&&source.ino===target.ino))throw Error('REPLICA_ROOT_OVERLAP');
 if(requireDistinctDevice&&source.dev===target.dev)throw Error('REPLICA_DEVICE_NOT_DISTINCT');
 const manifest=await catalog.lookup(name);
 const trusted={lookup:async()=>manifest};
 const signed=keyring?await readNativeReceipt({root:sourceRoot,name,keyring}):null;
 if(signed&&(signed.manifest.sha256!==manifest.sha256||signed.manifest.bytes!==manifest.bytes))throw Error('REPLICA_RECEIPT_CONFLICT');
 const inspectSource=createNativeCatalogInspector({root:sourceRoot,catalog:trusted});
 const inspectTarget=createNativeCatalogInspector({root:targetRoot,catalog:trusted});
 if((await inspectSource(name)).status!=='RESTORE_VERIFICATION_REQUIRED')throw Error('REPLICA_SOURCE_UNVERIFIED');
 const release=await acquire(targetRoot);
 if(!release)throw Error('REPLICA_LOCKED');
 try{
  const current=await inspectTarget(name);
  const existing=current.status==='RESTORE_VERIFICATION_REQUIRED';
  if(!existing&&current.status!=='ARCHIVE_MISSING')throw Error('REPLICA_TARGET_CONFLICT');
  if(!existing){
  await retrieve(sourceRoot,name,path.join(targetRoot,name),manifest.sha256);
  const h=await fs.open(path.join(targetRoot,name),'r+');try{await h.sync();}finally{await h.close();}
  const d=await fs.open(targetRoot,'r');try{await d.sync();}finally{await d.close();}
  if((await inspectTarget(name)).status!=='RESTORE_VERIFICATION_REQUIRED')throw Error('REPLICA_TARGET_UNVERIFIED');
  }
  if(signed){
   try{await persistReceipt({root:targetRoot,name,keyring,receipt:signed.receipt});}catch(e){if(e.code!=='EEXIST')throw e;}
   const copied=await readNativeReceipt({root:targetRoot,name,keyring});
   if(JSON.stringify(copied.receipt)!==JSON.stringify(signed.receipt))throw Error('REPLICA_RECEIPT_CONFLICT');
  }
  return {status:existing?'ALREADY_PRESENT':'REPLICATED',restoreVerified:false,distinctDevice:source.dev!==target.dev,...(signed?{receiptVerified:true}:{})};
 }finally{await release();}
}
module.exports={replicateArchive};
