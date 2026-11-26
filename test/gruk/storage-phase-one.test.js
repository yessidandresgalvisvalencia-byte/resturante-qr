"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {registerStoragePhaseOne}=require("../../core/health/storagePhaseOne.routes");
test("phase one is standby only, even with real backup flag set",()=>{
 for(const enabled of ["false","true"]){
  let handler,code,body,cache;
  const app={get(route,fn){assert.equal(route,"/health/storage");handler=fn;}};
  const state=registerStoragePhaseOne(app,{env:{GRUK_NATIVE_REAL_BACKUP_ENABLED:enabled},log:()=>{}});
  const res={set(k,v){assert.equal(k,"Cache-Control");cache=v;return this;},status(c){code=c;return this;},json(b){body=b;return this;}};
  handler({},res);
  assert.equal(cache,"no-store");
  assert.equal(code,enabled==="true"?503:200);
  assert.equal(body.realBackupEnabled,false);
  assert.equal(body.readyForRealBackup,false);
  assert.equal(state.mode,"standby");
  assert.equal(body.status,enabled==="true"?"configuration-blocked":"standby");
 }
});
