'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDriveInspector}=require('../../scripts/gruk/drive-remote-inspector');
const {reconcileBackup}=require('../../scripts/gruk/drive-backup-reconciliation');
const folder='1_1OxE9Ey7kr-GoCjOnC_Elm_sJpTQrfN',name='gruk-restaurante-1-1.archive.age';
const meta={id:folder,mimeType:'application/vnd.google-apps.folder',trashed:false};
const obj={id:'one',name,parents:[folder],mimeType:'application/octet-stream',trashed:false,size:'100'};
function mock(pages){
 let i=0;
 return async(url,opts)=>{
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
  const u=new URL(url);assert.equal(u.origin,'https://www.googleapis.com');
  if(i>0)assert.match(u.searchParams.get('q'),/trashed = false/);
  const body=pages[i++];assert.ok(body);return {ok:true,json:async()=>body};
 };
}
test('remote inspection paginates exact private folder and classifies duplicate objects',async()=>{
 const inspectRemote=createDriveInspector({folder,token:'synthetic',fetchImpl:mock([meta,{incompleteSearch:false,files:[obj],nextPageToken:'next'},{incompleteSearch:false,files:[{...obj,id:'two'}]}])});
 const result=await reconcileBackup({name,catalog:{lookup:async()=>({bytes:100})},inspectRemote});
 assert.equal(result.status,'DUPLICATE_REMOTE_OBJECTS');
 assert.equal(result.restoreVerified,false);
});
test('incomplete or wrong-folder results never certify a missing upload',async()=>{
 for(const data of [{incompleteSearch:true,files:[]},{incompleteSearch:false,files:[{...obj,parents:['other']}]},{files:[]}]){
  const inspect=createDriveInspector({folder,token:'synthetic',fetchImpl:mock([meta,data])});
  await assert.rejects(inspect(name),/DRIVE_INSPECTION/);
 }
 assert.throws(()=>createDriveInspector({folder:'wrong',token:'synthetic'}),/DRIVE_INSPECTOR_CONFIG/);
});
