'use strict';
const {execFile}=require('node:child_process');
const path=require('node:path');
const {randomInt}=require('node:crypto');
const {prepareCloudPublication}=require('./native-storage-cloud-publication');
const {prepareSignedRegistration}=require('./native-storage-signed-runtime');
async function defaultConnect(uri,options){const c=require('mongoose').createConnection(uri,options);try{return await c.asPromise();}catch(e){await c.close().catch(()=>{});throw e;}}
function createBackupAdapter({env=process.env,execute=execFile,timeoutMs=900000,connect=defaultConnect,prepareRegistration=prepareSignedRegistration}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>3600000)throw Error('INVALID_TIMEOUT');
 return async function backup(){
  if(env.GRUK_NATIVE_REAL_BACKUP_ENABLED!=='true'||env.GRUK_BACKUP_APPROVAL!=='RESPALDAR_SOLO_RESTAURANTE'||env.GRUK_ENTERPRISE_DB!=='restaurante'||env.GRUK_ENTERPRISE_DB_CONFIRM!=='restaurante')throw Error('BACKUP_NOT_AUTHORIZED');
  const signed=env.GRUK_NATIVE_SIGNED_REGISTRATION_ENABLED==='true';
  if(env.GRUK_CATALOG_ENABLED==='true'&&!signed)throw Error('NATIVE_SIGNED_REGISTRATION_REQUIRED');
  const required=env.GRUK_NATIVE_REPLICATION_REQUIRED==='true';
  if(required&&!signed)throw Error('NATIVE_REPLICATION_REQUIRES_SIGNING');
  const publish=env.GRUK_NATIVE_CLOUD_PUBLICATION_ENABLED==='true'?prepareCloudPublication(env,connect):null;
  const register=signed?prepareRegistration(env,connect):null;
  if(required){if(typeof register.preflight!=='function')throw Error('NATIVE_REPLICATION_PREFLIGHT_REQUIRED');await register.preflight();}
  const childEnv={};
  for(const key of ['PATH','HOME','TMPDIR','GRUK_ENTERPRISE_BACKUP_URI','GRUK_NATIVE_BACKUP_ROOT','GRUK_BACKUP_AGE_RECIPIENT','GRUK_BACKUP_AGE_IDENTITY','GRUK_BACKUP_APPROVAL','GRUK_ENTERPRISE_DB','GRUK_ENTERPRISE_DB_CONFIRM']){
   if(env[key]!==undefined)childEnv[key]=env[key];
  }
  childEnv.GITHUB_RUN_ID=String(Date.now())+String(randomInt(100000,999999));
  childEnv.GITHUB_RUN_ATTEMPT='1';
  await new Promise((resolve,reject)=>{
   execute('/bin/bash',[path.join(__dirname,'native-backup-restore.sh')],{cwd:path.resolve(__dirname,'../..'),env:childEnv,timeout:timeoutMs,maxBuffer:1048576},(error,stdout)=>{
    if(error||!String(stdout).includes('GRUK_NATIVE_BACKUP_REAL_RESTORE_OK:'))return reject(Error('BACKUP_EXECUTION_FAILED'));
    if(signed&&!String(stdout).split(/\r?\n/).includes('BACKUP_RUN_ID='+childEnv.GITHUB_RUN_ID+'-'+childEnv.GITHUB_RUN_ATTEMPT))return reject(Error('BACKUP_RUN_ID_UNVERIFIED'));
    resolve();
   });
  });
  if(register){const name='gruk-restaurante-'+childEnv.GITHUB_RUN_ID+'-'+childEnv.GITHUB_RUN_ATTEMPT+'.archive.age';const result=await register(name);if(result?.name!==name||result.status!=='REGISTERED'||result.restoreVerified!==false)throw Error('NATIVE_REGISTRATION_UNVERIFIED');if(required&&result.replicationVerified!==true)throw Error('NATIVE_REPLICATION_UNVERIFIED');if(publish){const cloud=await publish(name);if(cloud?.name!==name||cloud.status!=='CLOUD_CIPHERTEXT_VERIFIED')throw Error('CLOUD_PUBLICATION_UNVERIFIED');}}
 };
}
module.exports={createBackupAdapter};
