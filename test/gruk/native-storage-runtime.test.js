'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRuntime}=require('../../scripts/gruk/native-storage-runtime');
test('runtime launches only local service and keeps real backups blocked',async()=>{
 let launches=0,executions=0;
 const env={GRUK_NATIVE_BACKUP_ROOT:'/synthetic/vault'};
 const launch=async()=>{launches++;return {shutdown:async()=>{}};};
 const execute=()=>{executions++;};
 assert.throws(()=>createRuntime({env:{...env,GRUK_NATIVE_REAL_BACKUP_ENABLED:'true'},launch,execute}),/REAL_BACKUP_RELEASE_BLOCKED/);
 assert.throws(()=>createRuntime({env:{},launch,execute}),/INVALID_CONFIG/);
 const runtime=createRuntime({env,launch,execute});
 await runtime.start();
 await runtime.shutdown();
 assert.equal(launches,1);
 assert.equal(executions,0);
 assert.deepEqual(runtime.status(),{realBackupEnabled:false,scheduler:{busy:false,lastSuccess:null,lastFailure:null,running:false}});
});

test('synthetic runtime starts scheduler, delivers administrative alerts and drains on shutdown',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gruk-runtime-'));
 let resolveAlert;
 const alerted=new Promise(resolve=>{resolveAlert=resolve;});
 let executions=0,stopped=0;
 const runtime=createRuntime({env:{GRUK_NATIVE_BACKUP_ROOT:root},signals:false,
  launch:async({signals})=>{assert.equal(signals,false);return {shutdown:async()=>{stopped++;}};},
  intervalMs:1000,policy:{minFreeBytes:0},syntheticBackup:async()=>{executions++;throw Error('private synthetic detail');},
  write:(line,done)=>{const event=JSON.parse(line);assert.ok(['BACKUP_FAILED','LOW_CAPACITY'].includes(event.code));assert.equal(line.includes('private synthetic detail'),false);done();resolveAlert(event);}
 });
 let timer;
 try{
  await runtime.start();
  assert.equal(runtime.status().scheduler.running,true);
  await Promise.race([alerted,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('ALERT_TIMEOUT')),5000);})]);
  await runtime.shutdown();
  assert.equal(runtime.status().scheduler.running,false);
  assert.equal(runtime.status().scheduler.busy,false);
  assert.equal(stopped,1);
  assert.ok(executions<=1);
 }finally{clearTimeout(timer);await runtime.shutdown();await fs.rm(root,{recursive:true,force:true});}
});
