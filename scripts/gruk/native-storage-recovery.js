'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {marker}=require('./native-storage-replay');
async function inspectRecovery(root){
 if(!root||!path.isAbsolute(root)||root===path.parse(root).root||await fs.realpath(root)!==root)throw Error('INVALID_ROOT');
 const st=await fs.lstat(root);
 if(!st.isDirectory()||(st.mode&0o077))throw Error('INVALID_ROOT');
 const entries=await fs.readdir(root,{withFileTypes:true});
 const lock=entries.find(e=>e.name==='.backup.lock');
 const unexpected=entries.filter(e=>e.name!=='.backup.lock'&&e.name!=='backup-history.jsonl'&&!marker.test(e.name)&&!/^gruk-restaurante-[0-9]+-[0-9]+\.archive\.age$/.test(e.name)).length;
 const unsafe=entries.some(e=>e.isSymbolicLink()||(e.name==='.backup.lock'?!e.isDirectory():!e.isFile()));
 return {status:lock||unexpected||unsafe?'review-required':'clear',lockPresent:Boolean(lock),unexpectedEntries:unexpected,unsafeEntries:unsafe,automaticDeletion:false};
}
module.exports={inspectRecovery};
