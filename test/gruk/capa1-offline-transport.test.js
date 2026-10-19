"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {synchronize,synchronizeAll}=require("../../public/js/gruk-offline-transport");
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

test("Capa 2: one send drains 250 local events as 100+100+50 without deletion",async()=>{
 const pending=Array.from({length:250},(_,i)=>({eventId:"01ARZ3NDEKTSV4RRFFQ69G5"+String(i).padStart(3,"0")}));
 const acknowledged=new Set(), sizes=[];
 const outbox={
  listPending:async limit=>pending.filter(e=>!acknowledged.has(e.eventId)).slice(0,limit),
  markReceived:async id=>{acknowledged.add(id);return true;}
 };
 const fetchFn=async(_url,options)=>{
  const events=JSON.parse(options.body).events;sizes.push(events.length);
  return {status:202,json:async()=>({ok:true,applied:false,
   events:events.map(e=>({eventId:e.eventId,status:"RECIBIDO"}))})};
 };
 const result=await synchronizeAll({outbox,context:ctx,token:"jwt",fetchFn});
 assert.deepEqual(result,{sent:250,received:250,batches:3,complete:true});
 assert.deepEqual(sizes,[100,100,50]);assert.equal(acknowledged.size,250);
});
test("Capa 2: failed later batch retains every unacknowledged event for retry",async()=>{
 const pending=Array.from({length:150},(_,i)=>({eventId:"01ARZ3NDEKTSV4RRFFQ69G5"+String(i).padStart(3,"0")}));
 const acknowledged=new Set();let requests=0;
 const outbox={
  listPending:async limit=>pending.filter(e=>!acknowledged.has(e.eventId)).slice(0,limit),
  markReceived:async id=>{acknowledged.add(id);return true;}
 };
 await assert.rejects(synchronizeAll({outbox,context:ctx,token:"jwt",
  fetchFn:async(_url,options)=>{
   requests++;
   if(requests===2)return {status:503};
   return {status:202,json:async()=>({ok:true,applied:false,
     events:JSON.parse(options.body).events.map(e=>({eventId:e.eventId,status:"RECIBIDO"}))})};
  }}),/SYNC_NOT_ACCEPTED/);
 assert.equal(requests,2);assert.equal(acknowledged.size,100);
 assert.equal((await outbox.listPending(100)).length,50);
});
test("Capa 2: bounded batch count never falsely claims a drained outbox",async()=>{
 const pending=Array.from({length:250},(_,i)=>({eventId:"01ARZ3NDEKTSV4RRFFQ69G5"+String(i).padStart(3,"0")}));
 const done=new Set();
 const result=await synchronizeAll({context:ctx,token:"jwt",maxBatches:2,
  outbox:{listPending:async limit=>pending.filter(e=>!done.has(e.eventId)).slice(0,limit),
   markReceived:async id=>{done.add(id);return true;}},
  fetchFn:async(_url,options)=>({status:202,json:async()=>({ok:true,applied:false,
   events:JSON.parse(options.body).events.map(e=>({eventId:e.eventId,status:"RECIBIDO"}))})})});
 assert.deepEqual(result,{sent:200,received:200,batches:2,complete:false});
 assert.equal(done.size,200);
});

test("Capa 2: malformed or repeated local event IDs never cross network",async()=>{
 const good={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV"};
 for(const events of [
  [good,good],
  [{eventId:"invalid"}],
  [{eventId:7}],
  [null],
  Array.from({length:101},(_,i)=>({eventId:"01ARZ3NDEKTSV4RRFFQ69G5"+String(i).padStart(3,"0")})),
  null,
  {}
 ]){
  let calls=0,marked=0;
  const outbox={listPending:async()=>events,markReceived:async()=>{marked++;return true;}};
  await assert.rejects(synchronize({outbox,token:"jwt",fetchFn:async()=>{calls++;throw Error("FORBIDDEN_NETWORK");},
    context:ctx}),{message:"SYNC_INVALID_LOCAL_EVENTS"});
  assert.equal(calls,0);assert.equal(marked,0);
 }
});
test("Capa 2: invalid page limits reject before accessing local outbox",async()=>{
 for(const limit of [0,-1,101,1.5,NaN,Infinity,"100"]){
  let reads=0;
  await assert.rejects(synchronize({outbox:{listPending:async()=>{reads++;return [];},markReceived:async()=>true},
    token:"jwt",fetchFn:async()=>{throw Error("FORBIDDEN_NETWORK");},context:ctx,limit}),
    {message:"SYNC_LIMIT"});
  assert.equal(reads,0);
 }
});
