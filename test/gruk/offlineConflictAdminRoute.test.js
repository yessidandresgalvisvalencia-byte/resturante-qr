"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../routes/sync.js"),"utf8");
function fixture({role="ADMIN_SEDE",ready=true,missing=false}={}){
 const routes={},calls=[];
 const db={};
 const auth={empresaId:"507f191e810c19729de860ea",
  sedeId:"507f1f77bcf86cd799439012",usuarioId:"admin",rol:role};
 const imports={
  express:{Router:()=>({get(url,...handlers){routes["GET "+url]=handlers.at(-1);},
   post(url,...handlers){routes["POST "+url]=handlers.at(-1);}})},
  mongoose:{connection:{readyState:ready?1:0,db}},
  "../core/auth/auth.middleware":()=>{},
  "../core/offline/offlineInbox.service":{acceptOfflineBatch:()=>[],ensureInboxIndexes:()=>{}},
  "../core/offline/offlineStatus.service":{readOfflineStatuses:()=>[]},
  "../core/offline/offlineReconciliation.service":{readOfflineReconciliation:()=>[]},
  "../core/offline/offlineConflictAdmin.service":{
   listStockConflicts:async input=>{calls.push({method:"list",input});return [];},
   appendStockConflictReview:async input=>{calls.push({method:"review",input});
    if(missing)throw Object.assign(Error("missing"),{code:"OFFLINE_CONFLICT_NOT_FOUND"});
    return {decisionId:input.decisionId,status:"REVISION_REGISTRADA",applied:false,cobrado:false};}
  }
 };
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,require:k=>imports[k],console});
 async function request(method,url,body={}){
  let status=200,json,cache;
  await routes[method+" "+url]({auth,body},{status(code){status=code;return this;},
   set(key,value){if(key==="Cache-Control")cache=value;return this;},
   json(value){json=value;return this;}});
  return {status,json,cache};
 }
 return {request,calls,auth};
}
test("offline conflict admin: employee cannot list nor add reviews",async()=>{
 const f=fixture({role:"EMPLEADO"});
 for(const [m,u] of [["GET","/stock-conflicts"],["POST","/stock-conflicts/review"]]){
  const r=await f.request(m,u);assert.equal(r.status,403);assert.equal(r.json.ok,false);
 }
 assert.equal(f.calls.length,0);
});
test("offline conflict admin: GET list and POST decision never confirm money",async()=>{
 const f=fixture();
 const listing=await f.request("GET","/stock-conflicts");
 assert.equal(listing.status,200);assert.equal(listing.json.readOnly,true);
 assert.equal(listing.cache,"no-store");
 const decision=await f.request("POST","/stock-conflicts/review",{
  conflictId:"offline-stock-"+"a".repeat(64),decisionId:"01ARZ3NDEKTSV4RRFFQ69G5FA0",
  action:"ACUSAR_RECIBO",note:"Se revisará el faltante"});
 assert.equal(decision.status,201);assert.equal(decision.json.applied,false);
 assert.equal(decision.json.cobrado,false);
 assert.equal(f.calls.length,2);
 assert.equal(f.calls[0].input.auth,f.auth);
 assert.equal(f.calls[1].input.auth,f.auth);
});
test("offline conflict admin: disconnected DB and missing conflict fail closed",async()=>{
 const down=fixture({ready:false});
 assert.equal((await down.request("GET","/stock-conflicts")).status,503);
 assert.equal((await down.request("POST","/stock-conflicts/review")).status,503);
 assert.equal(down.calls.length,0);
 const missing=fixture({missing:true});
 const response=await missing.request("POST","/stock-conflicts/review");
 assert.equal(response.status,404);
 assert.equal(response.json.ok,false);
});
