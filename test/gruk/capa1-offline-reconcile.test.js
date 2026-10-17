"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {checkStatus}=require("../../public/js/gruk-offline-reconcile");
const a="01ARZ3NDEKTSV4RRFFQ69G5FAV";
test("read-only remote status preserves pending state",async()=>{
 const output=await checkStatus({eventIds:[a],token:"signed",fetchFn:async(url,options)=>{
  assert.equal(url,"/api/sync/status");
  assert.equal(options.method,"POST");
  assert.equal(options.headers.Authorization,"Bearer signed");
  return {status:200,json:async()=>({ok:true,events:[{eventId:a,status:"PENDIENTE",applied:false}]})};
 }});
 assert.deepEqual(output.events,[{eventId:a,status:"PENDIENTE",applied:false}]);
});
test("reject forged applied, missing ids and duplicated replies",async()=>{
 for(const events of [
  [{eventId:a,status:"PENDIENTE",applied:true}],
  [{eventId:a,status:"APLICADO",applied:false}],
  [{eventId:"NOT_OURS",status:"APLICADO",applied:true}],
  [{eventId:a,status:"APLICADO",applied:true},{eventId:a,status:"APLICADO",applied:true}]
 ]){
  await assert.rejects(checkStatus({eventIds:[a],token:"signed",fetchFn:async()=>({status:200,json:async()=>({ok:true,events})})}),/SYNC_STATUS_INVALID/);
 }
});
test("missing auth rejects before network",async()=>{
 let called=false;
 await assert.rejects(checkStatus({eventIds:[a],token:"",fetchFn:async()=>{called=true;}}),/SYNC_AUTH_REQUIRED/);
 assert.equal(called,false);
});
