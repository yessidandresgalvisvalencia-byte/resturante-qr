"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const panel=require("../../public/js/gruk-offline-conflicts-panel");
const cid="offline-stock-"+"a".repeat(64),id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
test("admin conflict UI loads through JWT and never sends inventory/payment mutations",async()=>{
 const seen=[];
 const fetchFn=async(url,options)=>{
  seen.push({url,options});
  if(url.endsWith("/review"))return {status:201,json:async()=>({
   ok:true,decisionId:id,conflictId:cid,applied:false,cobrado:false})};
  return {status:200,json:async()=>({ok:true,readOnly:true,conflicts:[
   {conflictId:cid,issues:[{productoId:"507f1f77bcf86cd799439011",faltante:"1"}]}
  ]})};
 };
 const rows=await panel.list({token:"token",fetchFn});
 assert.equal(rows.length,1);
 const record=await panel.review({token:"token",fetchFn,conflictId:cid,decisionId:id,
  action:"ESCALAR_AUDITORIA",note:"Revisión manual requerida"});
 assert.equal(record.applied,false);assert.equal(record.cobrado,false);
 assert.deepEqual(seen.map(x=>x.url),["/api/sync/stock-conflicts","/api/sync/stock-conflicts/review"]);
 assert.equal(JSON.parse(seen[1].options.body).action,"ESCALAR_AUDITORIA");
 const source=fs.readFileSync(path.join(__dirname,"../../public/js/gruk-offline-conflicts-panel.js"),"utf8");
 assert.doesNotMatch(source,/\/api\/sync\/stage-orders|\/pagos\/|deleteDatabase\(/);
 assert.match(fs.readFileSync(path.join(__dirname,"../../public/admin.html"),"utf8"),/offline-conflicts\.html/);
});
test("admin conflict UI prevents malformed IDs and dangerous decisions",async()=>{
 let calls=0;const fetchFn=async()=>{calls++;throw Error("UNEXPECTED_FETCH");};
 for(const patch of [{decisionId:"bad"},{conflictId:"bad"},{action:"DESCONTAR_STOCK"},{note:"short"}]){
  await assert.rejects(panel.review({token:"token",fetchFn,conflictId:cid,decisionId:id,
    action:"ACUSAR_RECIBO",note:"Motivo suficientemente largo",...patch}),/OFFLINE_REVIEW_INVALID_DECISION/);
 }
 assert.equal(calls,0);
});
test("admin conflict UI uses strong random ULID, never Math.random",()=>{
 const cryptoSource={getRandomValues(bytes){bytes.fill(8);return bytes;}};
 assert.match(panel.createDecisionId(cryptoSource,1750000000000),/^[0-9A-HJKMNP-TV-Z]{26}$/);
 assert.throws(()=>panel.createDecisionId(null),/OFFLINE_REVIEW_CRYPTO_REQUIRED/);
});

test("admin conflict UI: recheck stock only by read-only GET; never stage a sale",async()=>{
 const calls=[];
 const result=await panel.preflight({token:"jwt",conflictId:cid,fetchFn:async(url,options)=>{
  calls.push({url,options});
  return {status:200,json:async()=>({ok:true,readOnly:true,conflictId:cid,
   ready:true,applied:false,cobrado:false,inventoryChanges:false,products:[]})};
 }});
 assert.equal(result.ready,true);
 assert.equal(calls[0].options.method,"GET");
 assert.ok(calls[0].url.includes("/stock-conflicts/preflight?conflictId="));
 assert.equal(calls.length,1);
 await assert.rejects(panel.preflight({token:"jwt",conflictId:"bad",
   fetchFn:async()=>{throw Error("SHOULD_NOT_FETCH");}}),/OFFLINE_REVIEW_INVALID_CONFLICT/);
});
