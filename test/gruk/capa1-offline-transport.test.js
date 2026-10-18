"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {synchronize}=require("../../public/js/gruk-offline-transport");
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
const a={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV"};
function stub(){const pending=[a],received=[];return {pending,received,listPending:async()=>pending,markReceived:async id=>{received.push(id);return true;}};}
test("only complete authenticated 202 inbox acknowledgement marks received",async()=>{
 const o=stub();
 const result=await synchronize({outbox:o,context:ctx,token:"jwt",fetchFn:async(url,options)=>{
  assert.equal(url,"/api/sync/batch");
  assert.equal(options.headers.Authorization,"Bearer jwt");
  return {status:202,json:async()=>({ok:true,applied:false,events:[{eventId:a.eventId,status:"RECIBIDO"}]})};
 }});
 assert.deepEqual(result,{sent:1,received:1});
 assert.deepEqual(o.received,[a.eventId]);
});
test("no ack, partial ack, unauthorized or financial applied never marks received",async()=>{
 for(const data of [{ok:false,applied:false,events:[]},{ok:true,applied:true,events:[{eventId:a.eventId,status:"RECIBIDO"}]},{ok:true,applied:false,events:[]},{ok:true,applied:false,events:[{eventId:"unknown",status:"RECIBIDO"}]}]){
  const o=stub();
  await assert.rejects(synchronize({outbox:o,context:ctx,token:"jwt",fetchFn:async()=>({status:202,json:async()=>data})}));
  assert.equal(o.received.length,0);
 }
 const o=stub();
 await assert.rejects(synchronize({outbox:o,context:ctx,token:"jwt",fetchFn:async()=>({status:401})}));
 assert.equal(o.received.length,0);
});
test("missing authentication fails without network access",async()=>{
 let touched=false;
 await assert.rejects(synchronize({outbox:stub(),context:ctx,token:"",fetchFn:async()=>{touched=true;}}),/SYNC_AUTH_REQUIRED/);
 assert.equal(touched,false);
});
