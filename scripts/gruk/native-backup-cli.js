'use strict';
const {store,retrieve}=require('./native-backup-storage');
const [,,mode,name,file,digest]=process.argv;
async function main(){
 const root=process.env.GRUK_NATIVE_BACKUP_ROOT;
 if(mode==='store' && name && file && !digest) await store(root,name,file);
 else if(mode==='retrieve' && name && file && digest) await retrieve(root,name,file,digest);
 else throw Error('INVALID_ARGS');
}
main().catch(()=>{console.error('GRUK_NATIVE_STORAGE_FAILED');process.exitCode=1;});
