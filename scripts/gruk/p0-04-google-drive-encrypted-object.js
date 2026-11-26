'use strict';
// Upload/download ONLY encrypted archives, using a dedicated Google OAuth
// refresh token. Never print access tokens, API response bodies or file data.
const fs = require('node:fs');
const {createWriteStream} = fs;
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {basename} = require('node:path');
const {createHash} = require('node:crypto');
const {assertUploadQuota}=require('./drive-backup-quota');
const {receiveArchive}=require('./drive-backup-download');

const [,,mode,source,other] = process.argv;
const folder = process.env.GRUK_DRIVE_BACKUP_FOLDER_ID;
const exactFolder = '1_1OxE9Ey7kr-GoCjOnC_Elm_sJpTQrfN';
const required = ['GRUK_DRIVE_OAUTH_CLIENT_ID','GRUK_DRIVE_OAUTH_CLIENT_SECRET','GRUK_DRIVE_OAUTH_REFRESH_TOKEN'];
function fail(message){ throw new Error(message); }
if (!['upload','download'].includes(mode) || !source || !other) fail('DRIVE_ARGS');
if (folder !== exactFolder) fail('DRIVE_FOLDER_MISMATCH');
for (const key of required) if (!process.env[key]) fail('DRIVE_CREDENTIAL_MISSING:' + key);
function assertArchive(file) {
  if (!file.endsWith('.archive.age') && !file.endsWith('.age')) fail('ONLY_CIPHERTEXT_ALLOWED');
}
if (mode === 'upload') {
  assertArchive(source);
  const h=fs.openSync(source,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try{
    const st=fs.fstatSync(h);
    if(!st.isFile()||st.size<64)fail('ENCRYPTED_ARCHIVE_EMPTY');
    const header=Buffer.alloc(22);
    if(fs.readSync(h,header,0,22,0)!==22||header.toString()!=='age-encryption.org/v1\n')fail('AGE_ARCHIVE_REQUIRED');
  }finally{fs.closeSync(h);}
  const allowedName = /^gruk-restaurante-[0-9]+-[0-9]+\.archive\.age$/;
  if (!allowedName.test(other)) fail('INVALID_ARCHIVE_NAME');
} else {
  assertArchive(other);
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(source)) fail('INVALID_GOOGLE_FILE_ID');
}
async function oauth(){
  const payload = new URLSearchParams({
    client_id:process.env.GRUK_DRIVE_OAUTH_CLIENT_ID,
    client_secret:process.env.GRUK_DRIVE_OAUTH_CLIENT_SECRET,
    refresh_token:process.env.GRUK_DRIVE_OAUTH_REFRESH_TOKEN,
    grant_type:'refresh_token'
  });
  const result = await fetch('https://oauth2.googleapis.com/token',{
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:payload,redirect:'error',signal:AbortSignal.timeout(25000)
  });
  if (!result.ok) fail('GOOGLE_TOKEN_REFRESH_FAILED');
  const obj=await result.json();
  if (!obj.access_token || obj.token_type?.toLowerCase()!=='bearer') fail('INVALID_OAUTH_TOKEN');
  return obj.access_token;
}
async function request(url, token, extra = {}) {
  if (!url.startsWith('https://www.googleapis.com/')) fail('INVALID_DRIVE_DESTINATION');
  const res=await fetch(url,{
    ...extra,headers:{Authorization:'Bearer '+token,...(extra.headers||{})},
    redirect:'error',signal:extra.signal||AbortSignal.timeout(180000)
  });
  if (!res.ok) fail('GOOGLE_DRIVE_REQUEST_FAILED_'+res.status);
  return res;
}
async function checkFolder(token){
  const res=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(folder)+
    '?fields=id,mimeType,trashed,capabilities(canAddChildren)',token);
  const f=await res.json();
  if(f.id!==folder||f.mimeType!=='application/vnd.google-apps.folder'||f.trashed||!f.capabilities?.canAddChildren){
    fail('GOOGLE_DRIVE_FOLDER_NOT_WRITABLE');
  }
}
async function main(){
  const token=await oauth();
  await checkFolder(token);
  if(mode==='upload'){
    const name=other,size=fs.statSync(source).size;
    const about=await request('https://www.googleapis.com/drive/v3/about?fields=storageQuota(limit,usage)',token);
    assertUploadQuota((await about.json()).storageQuota,size);
    const init=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,parents,size,md5Checksum',token,{
      method:'POST',
      headers:{
        'Content-Type':'application/json; charset=UTF-8',
        'X-Upload-Content-Type':'application/octet-stream',
        'X-Upload-Content-Length':String(size)
      },
      body:JSON.stringify({name,parents:[folder],mimeType:'application/octet-stream',description:'GRUK restaurante backup, age encrypted'})
    });
    const location=init.headers.get('location');
    if(!location || !location.startsWith('https://www.googleapis.com/upload/drive/v3/files')){
      fail('INVALID_RESUMABLE_UPLOAD_URL');
    }
    // One request streams the encrypted file; avoid loading the archive into RAM.
    const completed=await request(location,token,{
      method:'PUT',
      headers:{'Content-Type':'application/octet-stream','Content-Length':String(size)},
      body:fs.createReadStream(source),duplex:'half',signal:AbortSignal.timeout(600000)
    });
    const result=await completed.json();
    if(!/^[a-zA-Z0-9_-]+$/.test(result.id||'')||result.name!==name||!result.parents?.includes(folder)||
       Number(result.size)!==size) fail('UPLOAD_METADATA_UNVERIFIED');
    // Print ONLY the opaque ID; it is passed to a restore-from-Drive verification.
    process.stdout.write(result.id+'\n');
    return;
  }
  const res=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(source)+
    '?fields=id,name,parents,mimeType,trashed,size,md5Checksum',token);
  const metadata=await res.json();
  if(metadata.mimeType!=='application/octet-stream'||metadata.id!==source||!metadata.parents?.includes(folder)||metadata.trashed||
     !/^gruk-restaurante-[0-9]+-[0-9]+\.archive\.age$/.test(metadata.name||'')) fail('UNTRUSTED_DRIVE_OBJECT');
  const downloaded=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(source)+'?alt=media',token);
  if(!downloaded.body) fail('EMPTY_FILE_DOWNLOAD');
  await receiveArchive(Readable.fromWeb(downloaded.body),other,metadata);
  process.stdout.write('GRUK_DRIVE_ENCRYPTED_DOWNLOAD_OK\n');
}
main().catch(err=>{
  // No raw external error, URI, response body, credentials or stacktrace.
  const code=String(err.message||'');
  console.error('GRUK_DRIVE_BACKUP_FAILED: '+(/^(?:DRIVE_[A-Z0-9_]+|GOOGLE_[A-Z0-9_]+|INVALID_[A-Z0-9_]+|UPLOAD_METADATA_UNVERIFIED|EMPTY_FILE_DOWNLOAD)$/.test(code)?code:'UNKNOWN'));
  process.exitCode=1;
});
