"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../../routes/sync.js"),"utf8");
test("recepción offline devuelve 202 pero nunca confirma venta aplicada",async()=>{
  const handlers={};
  const router={post(path,...args){handlers[path]=args.at(-1);},get(path,...args){handlers[path]=args.at(-1);}};
  let called=0;
  const inbox={
    ensureInboxIndexes:async()=>{},
    acceptOfflineBatch:async()=>{called++;return [{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA0",status:"RECIBIDO"}];}
  };
  const modules={
    express:{Router:()=>router},
    mongoose:{connection:{readyState:1,db:{client:{startSession(){}}}}},
    "../core/auth/auth.middleware":()=>{},
    "../core/offline/offlineInbox.service":inbox,
    "../core/offline/offlineStatus.service":{readOfflineStatuses:async()=>[]},
    "../core/offline/offlineReconciliation.service":{readOfflineReconciliation:async()=>[]}
  };
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,
    require:name=>modules[name],console});
  let code=0,response;
  const res={status(v){code=v;return this;},json(v){response=v;return this;}};
  await handlers["/batch"]({auth:{empresaId:"empresa",sedeId:"sede",usuarioId:"actor"},
    body:{events:[{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA0"}]}},res);
  assert.equal(called,1);
  assert.equal(code,202);
  assert.equal(response.ok,true);
  assert.equal(response.applied,false);
  assert.equal(response.events[0].status,"RECIBIDO");
});
