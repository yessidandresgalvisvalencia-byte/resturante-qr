'use strict';
const FOLDER='1_1OxE9Ey7kr-GoCjOnC_Elm_sJpTQrfN';
function createDriveInspector({folder,token,fetchImpl=fetch}){
 if(folder!==FOLDER||typeof token!=='string'||!token||typeof fetchImpl!=='function')throw Error('DRIVE_INSPECTOR_CONFIG');
 async function get(url){
  const res=await fetchImpl(url,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw Error('DRIVE_INSPECTION_FAILED');
  return res.json();
 }
 return async function inspect(name){
  if(typeof name!=='string'||!/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(name))throw Error('DRIVE_INSPECTOR_NAME');
  const f=await get('https://www.googleapis.com/drive/v3/files/'+folder+'?fields=id,mimeType,trashed');
  if(f.id!==folder||f.mimeType!=='application/vnd.google-apps.folder'||f.trashed!==false)throw Error('DRIVE_INSPECTOR_FOLDER');
  const objects=[],seen=new Set();let pageToken;
  for(let page=0;page<10;page++){
   const url=new URL('https://www.googleapis.com/drive/v3/files');
   url.searchParams.set('q',"'"+folder+"' in parents and name = '"+name+"' and trashed = false");
   url.searchParams.set('fields','nextPageToken,incompleteSearch,files(id,name,parents,mimeType,trashed,size)');
   url.searchParams.set('pageSize','100');
   url.searchParams.set('spaces','drive');
   if(pageToken)url.searchParams.set('pageToken',pageToken);
   const data=await get(url.toString());
   if(data.incompleteSearch!==false||!Array.isArray(data.files))throw Error('DRIVE_INSPECTION_INCOMPLETE');
   for(const item of data.files){
    if(!item||typeof item.id!=='string'||!item.id||seen.has(item.id)||item.name!==name||!Array.isArray(item.parents)||!item.parents.includes(folder)||item.trashed!==false)throw Error('DRIVE_INSPECTION_UNVERIFIED');
    seen.add(item.id);
    objects.push({name:item.name,size:item.size,trashed:item.trashed,mimeType:item.mimeType,folderVerified:true});
    if(objects.length>100)throw Error('DRIVE_INSPECTION_LIMIT');
   }
   if(!data.nextPageToken)return objects;
   if(typeof data.nextPageToken!=='string'||data.nextPageToken.length>4096||data.nextPageToken===pageToken)throw Error('DRIVE_INSPECTION_INCOMPLETE');
   pageToken=data.nextPageToken;
  }
  throw Error('DRIVE_INSPECTION_LIMIT');
 };
}
module.exports={createDriveInspector};
