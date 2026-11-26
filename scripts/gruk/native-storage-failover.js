'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {retrieve}=require('./native-backup-storage');
const {readNativeReceipt,persistReceipt}=require('./native-storage-receipt-recovery');
const {acquire}=require('./native-storage-lock');
const {validateReplicaRoots}=require('./native-storage-replication');
const NAME=/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/;
async function stageRecovery({primaryRoot,replicaRoot,recoveryRoot,name,keyring,catalog}){
 if(typeof name!=='string'||!NAME.test(name)||typeof keyring?.verify!=='function'||typeof catalog?.lookup!=='function')throw Error('FAILOVER_CONFIG');
 for(const root of [primaryRoot,replicaRoot,recoveryRoot])if(typeof root!=='string'||!path.isAbsolute(root)||path.normalize(root)!==root||root===path.parse(root).root)throw Error('FAILOVER_ROOT');
 const roots=[primaryRoot,replicaRoot,recoveryRoot];
 for(let i=0;i<roots.length;i++)for(let j=i+1;j<roots.length;j++)if(roots[i]===roots[j]||roots[i].startsWith(roots[j]+'/')||roots[j].startsWith(roots[i]+'/'))throw Error('FAILOVER_ROOT_OVERLAP');
 const manifest=await catalog.lookup(name);
 let selected,verified;
 for(const [label,root] of [['primary',primaryRoot],['replica',replicaRoot]]){
  try{
   const candidate=await readNativeReceipt({root,name,keyring});
   if(candidate.manifest.sha256!==manifest.sha256||candidate.manifest.bytes!==manifest.bytes||candidate.manifest.name!==manifest.name)continue;
   selected={label,root};verified=candidate;break;
  }catch{}
 }
 if(!selected)throw Error('FAILOVER_NO_VERIFIED_COPY');
 await validateReplicaRoots({sourceRoot:selected.root,targetRoot:recoveryRoot,requireDistinctDevice:false});
 // Reject aliases to either source, including an accessible but damaged primary.
 const dst=await fs.stat(recoveryRoot);
 for(const root of [primaryRoot,replicaRoot]){
  try{const st=await fs.stat(root);if(st.dev===dst.dev&&st.ino===dst.ino)throw Error('FAILOVER_ROOT_OVERLAP');}
  catch(e){if(e.code!=='ENOENT'&&e.code!=='ENOTDIR')throw e;}
 }
 const release=await acquire(recoveryRoot);
 if(!release)throw Error('FAILOVER_LOCKED');
 try{
  await retrieve(selected.root,name,path.join(recoveryRoot,name),manifest.sha256);
  const h=await fs.open(path.join(recoveryRoot,name),'r+');try{await h.sync();}finally{await h.close();}
  await persistReceipt({root:recoveryRoot,name,keyring,receipt:verified.receipt});
  const staged=await readNativeReceipt({root:recoveryRoot,name,keyring});
  if(staged.manifest.sha256!==manifest.sha256||staged.manifest.bytes!==manifest.bytes)throw Error('FAILOVER_STAGE_UNVERIFIED');
  return {status:'STAGED',source:selected.label,receiptVerified:true,restoreVerified:false};
 }finally{await release();}
}
module.exports={stageRecovery};
