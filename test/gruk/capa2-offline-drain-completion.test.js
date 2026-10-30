"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {synchronizeAll}=require("../../public/js/gruk-offline-transport");
const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
const events=[
 {eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA0",...context},
 {eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA1",...context}
];
test("Capa 2: página parcial no implica cola vacía",async()=>{
 const acked=new Set();
 let reads=0,requests=0;
 const outbox={
   listPending:async()=>{reads++;return events.filter(e=>!acked.has(e.eventId)).slice(0,1);},
   markReceived:async id=>{acked.add(id);return true;}
 };
 const fetchFn=async(_url,options)=>{requests++;return {status:202,json:async()=>({
   ok:true,applied:false,events:JSON.parse(options.body).events.map(e=>({eventId:e.eventId,status:"RECIBIDO"}))
 })};};
 const r=await synchronizeAll({outbox,token:"jwt",context,fetchFn,limit:10,maxBatches:10});
 assert.deepEqual(r,{sent:2,received:2,batches:2,complete:true});
 assert.equal(reads,3,"debe comprobar una lectura final vacía");
 assert.equal(requests,2);
 assert.equal(acked.size,2);
});
test("Capa 2: límite de lotes nunca declara vacía una cola no comprobada",async()=>{
 const acked=new Set();
 const outbox={
   listPending:async()=>events.filter(e=>!acked.has(e.eventId)).slice(0,1),
   markReceived:async id=>{acked.add(id);return true;}
 };
 const fetchFn=async(_url,options)=>({status:202,json:async()=>({
   ok:true,applied:false,events:JSON.parse(options.body).events.map(e=>({eventId:e.eventId,status:"RECIBIDO"}))
 })});
 const result=await synchronizeAll({outbox,token:"jwt",context,fetchFn,limit:10,maxBatches:1});
 assert.deepEqual(result,{sent:1,received:1,batches:1,complete:false});
 assert.equal(acked.size,1);
});
