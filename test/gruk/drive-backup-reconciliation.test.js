'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reconcileBackup}=require('../../scripts/gruk/drive-backup-reconciliation');
test('reconciliation distinguishes missing, duplicate, unavailable and incomplete backups without claiming restoration',async()=>{
 const name='gruk-restaurante-1-1.archive.age';
 const catalog={async lookup(){return {name,bytes:100,sha256:'a'.repeat(64)};}};
 const object={name,size:'100',trashed:false,folderVerified:true,mimeType:'application/octet-stream'};
 const run=async(objects)=>reconcileBackup({name,catalog,inspectRemote:async()=>objects});
 for(const [objects,status] of [[[],'UPLOAD_NOT_CONFIRMED'],[[object,object],'DUPLICATE_REMOTE_OBJECTS'],[[{...object,size:'99'}],'REMOTE_SIZE_MISMATCH'],[[{...object,folderVerified:false}],'REMOTE_UNVERIFIED'],[[object],'RESTORE_VERIFICATION_REQUIRED']]){
  assert.deepEqual(await run(objects),{name,status,restoreVerified:false});
 }
 assert.equal((await reconcileBackup({name,catalog,inspectRemote:async()=>{throw Error('network');}})).status,'REMOTE_UNAVAILABLE');
 for(const [message,status] of [['CATALOG_NOT_FOUND','CATALOG_MISSING'],['SIGNED_MANIFEST_UNTRUSTED','CATALOG_UNVERIFIED']]){
  assert.equal((await reconcileBackup({name,catalog:{async lookup(){throw Error(message);}},inspectRemote:async()=>{assert.fail('unexpected remote access');}})).status,status);
 }
});
