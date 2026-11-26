'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {validateReplicaRoots}=require('./native-storage-replication');
async function inspectHost({primary,secondary,reserveBytes=1073741824}={}){
 if(!Number.isSafeInteger(reserveBytes)||reserveBytes<1)throw Error('INVALID_RESERVE');
 const issues=[];
 if(process.platform!=='linux')issues.push('LINUX_REQUIRED');
 if(typeof process.getuid!=='function'||process.getuid()===0)issues.push('NON_ROOT_REQUIRED');
 if(Number(process.versions.node.split('.')[0])<20)issues.push('NODE_VERSION');
 const volumes={};
 for(const [label,root] of [['primary',primary],['secondary',secondary]]){
  try{
   if(typeof root!=='string'||!path.isAbsolute(root)||path.normalize(root)!==root||root===path.parse(root).root||await fs.realpath(root)!==root)throw Error('ROOT');
   const st=await fs.lstat(root);
   if(!st.isDirectory()||(st.mode&0o077)||st.uid!==process.getuid())throw Error('ROOT');
   const disk=await fs.statfs(root,{bigint:true});
   const available=disk.bavail*disk.bsize;
   volumes[label]={availableBytes:available.toString(),capacitySufficient:available>=BigInt(reserveBytes)};
   if(available<BigInt(reserveBytes))issues.push(label.toUpperCase()+'_LOW_CAPACITY');
  }catch{issues.push(label.toUpperCase()+'_PRIVATE_VOLUME_REQUIRED');}
 }
 if(volumes.primary&&volumes.secondary){
  try{await validateReplicaRoots({sourceRoot:primary,targetRoot:secondary});}
  catch{issues.push('DISTINCT_DEVICES_REQUIRED');}
 }
 return {status:issues.length?'BLOCKED':'LOCAL_CHECKS_PASSED',issues,volumes,persistenceVerified:false,physicalIndependenceVerified:false,productionReady:false};
}
if(require.main===module)inspectHost({primary:process.argv[2],secondary:process.argv[3]}).then(r=>{console.log(JSON.stringify(r));if(r.issues.length)process.exitCode=1;}).catch(()=>{console.error('HOST_PREFLIGHT_FAILED');process.exitCode=1;});
module.exports={inspectHost};
