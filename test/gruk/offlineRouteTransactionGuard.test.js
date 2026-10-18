"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname,"../../routes/sync.js"),"utf8");
test("sync batch multi-evento rechaza sesión transaccional no disponible sin guardar",async()=>{
  let writes = 0;
  const handlers = {};
  const router = {post(route,...fns){handlers[route]=fns.at(-1);}};
  const mongoose = {connection:{readyState:1,db:{collection(){writes++;throw Error("unexpected write");}}}};
  const module = {exports:{}};
  const imports = {
    express:{Router:()=>router},mongoose,
    "../core/auth/auth.middleware":()=>{},
    "../core/offline/offlineInbox.service":{
      ensureInboxIndexes:async()=>{writes++;},
      acceptOfflineBatch:async()=>{writes++;}
    },
    "../core/offline/offlineStatus.service":{readOfflineStatuses:async()=>[]}
  };
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>{
    if (!(name in imports))throw Error(name);
    return imports[name];
  },console});
  let statusCode;
  let response;
  const res = {status(n){statusCode=n;return this;},json(v){response=v;return this;}};
  await handlers["/batch"]({auth:{empresaId:"a",sedeId:"b",usuarioId:"c"},
    body:{events:[{eventId:"one"},{eventId:"two"}]}},res);
  assert.equal(statusCode,503);
  assert.equal(response.error,"OFFLINE_TRANSACTION_UNAVAILABLE");
  assert.equal(writes,0);
});

test("sync batch: fallo de sesión del núcleo responde 503 reintentable",async()=>{
  const handlers={};
  const router={post(route,...handlersList){handlers[route]=handlersList.at(-1);}};
  const mongoose={connection:{readyState:1,db:{client:{startSession:()=>({})}}}};
  const unavailable=Object.assign(new Error("unavailable"),{code:"OFFLINE_TRANSACTION_UNAVAILABLE"});
  const imports={
    express:{Router:()=>router},mongoose,
    "../core/auth/auth.middleware":()=>{},
    "../core/offline/offlineInbox.service":{
      ensureInboxIndexes:async()=>{},
      acceptOfflineBatch:async()=>{throw unavailable;}
    },
    "../core/offline/offlineStatus.service":{readOfflineStatuses:async()=>[]}
  };
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>imports[name],console});
  let statusCode=0,body=null;
  const res={status(code){statusCode=code;return this;},json(value){body=value;return this;}};
  await handlers["/batch"]({auth:{empresaId:"a",sedeId:"b",usuarioId:"c"},
    body:{events:[{eventId:"a"},{eventId:"b"}]}},res);
  assert.equal(statusCode,503);
  assert.equal(body.error,"OFFLINE_TRANSACTION_UNAVAILABLE");
  assert.equal(body.applied,false);
});
