'use strict';
const {execFile}=require('node:child_process');
const path=require('node:path');
const {randomInt}=require('node:crypto');
function createBackupAdapter({env=process.env,execute=execFile,timeoutMs=900000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>3600000)throw Error('INVALID_TIMEOUT');
 return async function backup(){
  if(env.GRUK_NATIVE_REAL_BACKUP_ENABLED!=='true'||env.GRUK_BACKUP_APPROVAL!=='RESPALDAR_SOLO_RESTAURANTE'||env.GRUK_ENTERPRISE_DB!=='restaurante'||env.GRUK_ENTERPRISE_DB_CONFIRM!=='restaurante')throw Error('BACKUP_NOT_AUTHORIZED');
  const childEnv={};
  for(const key of ['PATH','HOME','TMPDIR','GRUK_ENTERPRISE_BACKUP_URI','GRUK_NATIVE_BACKUP_ROOT','GRUK_BACKUP_AGE_RECIPIENT','GRUK_BACKUP_AGE_IDENTITY','GRUK_BACKUP_APPROVAL','GRUK_ENTERPRISE_DB','GRUK_ENTERPRISE_DB_CONFIRM']){
   if(env[key]!==undefined)childEnv[key]=env[key];
  }
  childEnv.GITHUB_RUN_ID=String(Date.now())+String(randomInt(100000,999999));
  childEnv.GITHUB_RUN_ATTEMPT='1';
  await new Promise((resolve,reject)=>{
   execute('/bin/bash',[path.join(__dirname,'native-backup-restore.sh')],{cwd:path.resolve(__dirname,'../..'),env:childEnv,timeout:timeoutMs,maxBuffer:1048576},(error,stdout)=>{
    if(error||!String(stdout).includes('GRUK_NATIVE_BACKUP_REAL_RESTORE_OK:'))return reject(Error('BACKUP_EXECUTION_FAILED'));
    resolve();
   });
  });
 };
}
module.exports={createBackupAdapter};
