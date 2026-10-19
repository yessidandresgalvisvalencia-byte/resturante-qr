"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {readSession,statusLabel,launch}=require("../../public/js/gruk-offline-panel.js");
const token=payload=>"aaa."+Buffer.from(JSON.stringify(payload)).toString("base64url")+".bbb";
const payload={empresaId:"empresaA",sedeId:"sedeA",sub:"operadorA"};
test("operator identity comes from JWT claims, never URL or restaurant selector",()=>{
 const storage={getItem:k=>k==="grukAuthToken"?token(payload):null};
 assert.deepEqual(readSession(storage),{token:token(payload),context:{empresaId:"empresaA",sedeId:"sedeA",actorId:"operadorA"}});
});
test("panel rejects unauthenticated, sede missing and NoSQL operator identity before reading storage",()=>{
 for(const value of [null,token({...payload,sedeId:null}),token({...payload,sub:"$ne"}),"invalid.jwt"]){
  assert.throws(()=>readSession({getItem:()=>value}),/PANEL_AUTH_REQUIRED|PANEL_SEDE_REQUIRED/);
 }
});
test("status display never interprets merely received or in-review as paid",()=>{
 assert.match(statusLabel({syncStatus:"pending"}),/sin enviar/);
 assert.match(statusLabel({syncStatus:"received",serverStatus:"PENDIENTE"}),/pendiente/);
 assert.match(statusLabel({syncStatus:"received",serverStatus:"EN_REVISION",serverStaged:true}),/no equivale a pago/);
 assert.match(statusLabel({syncStatus:"received",serverStatus:"APLICADO",serverApplied:true,serverFinanciallyReconciled:true}),/conciliado/);
 assert.doesNotMatch(statusLabel({syncStatus:"received",serverStatus:"APLICADO",serverApplied:false}),/conciliado/);
});
test("panel shell links from existing admin, reuses core transport and never initiates payments",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../../public/offline-status.html"),"utf8");
 const admin=fs.readFileSync(path.join(__dirname,"../../public/admin.html"),"utf8");
 const sw=fs.readFileSync(path.join(__dirname,"../../public/service-worker.js"),"utf8");
 const controller=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-panel.js"),"utf8");
 assert.match(admin,/offline-status\.html/);
 assert.match(html,/gruk-offline-panel\.js/);
 assert.match(html,/gruk-offline-outbox\.js/);
 assert.match(html,/gruk-offline-transport\.js/);
 assert.match(sw,/offline-status\.html/);
 assert.doesNotMatch(controller,/\/pagos\/|\/api\/sync\/stage-orders|deleteDatabase\(/);
 assert.match(controller,/transport\.synchronizeAll\(/);
 assert.match(controller,/transport\.reconcileReceived\(/);
});
test("missing auth disables all operational controls and does not read the outbox",async()=>{
 const elems={};
 for(const name of ["rows","message","connection","identity","refresh","send","reconcile","draftForm","saveDraft","productId","quantity","unitPrice","refreshCatalog","catalogInfo","refreshStock","stockInfo","stockEstimate"]){
  elems[name]={disabled:false,textContent:""};
 }
 const result=await launch({document:{getElementById:name=>elems[name==="offlineDraftForm"?"draftForm":name]},window:{navigator:{onLine:true}},
  storage:{getItem:()=>null},outbox:{listLocal:()=>{throw Error("SHOULD_NOT_READ");}},
  transport:{},fetchFn:()=>{throw Error("SHOULD_NOT_FETCH");}});
 assert.equal(result.authenticated,false);
 assert.equal(elems.send.disabled,true);assert.equal(elems.refresh.disabled,true);
 assert.equal(elems.saveDraft.disabled,true);
 assert.equal(elems.refreshCatalog.disabled,true);
});
