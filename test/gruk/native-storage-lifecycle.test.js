'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {initialize}=require('../../scripts/gruk/native-storage-init');
const {start}=require('../../scripts/gruk/native-storage-service');
test('listener readiness, collision rejection and idempotent shutdown', {timeout:15000},async t=>{
 const tmp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gruk-life-')));
 t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
 const {root,keyFile}=await initialize(path.join(tmp,'storage'));
 const probe=net.createServer();
 await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
 const port=probe.address().port;
 await new Promise(resolve=>probe.close(resolve));
 const env={GRUK_NATIVE_BACKUP_ROOT:root,GRUK_STORAGE_SIGNING_KEY_FILE:keyFile,GRUK_STORAGE_PORT:String(port)};
 const service=await start({env,signals:false});
 t.after(()=>service.shutdown());
 assert.deepEqual(service.status(),{listening:true,closing:false});
 await assert.rejects(start({env,signals:false}),{code:'EADDRINUSE'});
 const a=service.shutdown(),b=service.shutdown();
 assert.equal(a,b);
 await a;
 assert.deepEqual(service.status(),{listening:false,closing:true});
 const restarted=await start({env,signals:false});
 t.after(()=>restarted.shutdown());
 assert.equal(restarted.status().listening,true);
 await restarted.shutdown();
});

test('initialized storage runs through runtime and rejects unsafe key paths', {timeout:15000},async t=>{
 const {createRuntime}=require('../../scripts/gruk/native-storage-runtime');
 const tmp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'gruk-install-')));
 t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
 const {root,keyFile}=await initialize(path.join(tmp,'storage'));
 const probe=net.createServer();
 await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
 const port=probe.address().port;
 await new Promise(resolve=>probe.close(resolve));
 const env={GRUK_NATIVE_BACKUP_ROOT:root,GRUK_STORAGE_SIGNING_KEY_FILE:keyFile,GRUK_STORAGE_PORT:String(port)};
 const alias=path.join(tmp,'alias');
 await fs.symlink(path.dirname(keyFile),alias);
 await assert.rejects(start({env:{...env,GRUK_STORAGE_SIGNING_KEY_FILE:path.join(alias,'signing.key')},signals:false}),/INVALID_KEY_PARENT/);
 const linked=path.join(tmp,'linked.key');
 await fs.link(keyFile,linked);
 await assert.rejects(start({env,signals:false}),/INVALID_KEY_FILE/);
 await fs.unlink(linked);
 const runtime=createRuntime({env,signals:false});
 try{
  await runtime.start();
  const health=await runtime.health();
  assert.equal(health.realBackupReady,false);
  assert.ok(['ready','degraded'].includes(health.status));
  assert.equal(runtime.status().scheduler.running,false);
 }finally{await runtime.shutdown();}
 assert.equal((await runtime.health()).code,'LISTENER_NOT_READY');
});
