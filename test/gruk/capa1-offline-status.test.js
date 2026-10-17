"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineStatuses}=require("../../core/offline/offlineStatus.service");
const a="01ARZ3NDEKTSV4RRFFQ69G5FAV",b="01ARZ3NDEKTSV4RRFFQ69G5FAW";
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
test("offline status queries scoped to tenant and actor, no financial posting",async()=>{
 let filter,projection;
 const db={collection:()=>({find:(f,o)=>{filter=f;projection=o.projection;return {toArray:async()=>[{eventId:a,status:"PENDIENTE"}]}}})};
 const result=await readOfflineStatuses({db,context:ctx,eventIds:[a,b]});
 assert.deepEqual(filter,{empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA",eventId:{$in:[a,b]}});
 assert.equal(projection._id,0);
 assert.deepEqual(result,[{eventId:a,status:"PENDIENTE",applied:false},{eventId:b,status:"NO_ENCONTRADO",applied:false}]);
});
test("invalid tenant and ids rejected without querying database",async()=>{
 let touched=false;
 const db={collection:()=>{touched=true;throw Error("QUERY_SHOULD_NOT_RUN")}};
 for(const context of [{empresaId:"empresaA",sedeId:null,actorId:"actorA"},null]){
  await assert.rejects(readOfflineStatuses({db,context,eventIds:[a]}),/OFFLINE_AUTH_REQUIRED/);
 }
 for(const ids of [[],[a,a],["not-valid"],Array(101).fill(a)]){
  await assert.rejects(readOfflineStatuses({db,context:ctx,eventIds:ids}),/OFFLINE_INVALID_IDS/);
 }
 assert.equal(touched,false);
});
test("only committed state is applied",async()=>{
 const db={collection:()=>({find:()=>({toArray:async()=>[{eventId:a,status:"APLICADO"}]})})};
 assert.deepEqual(await readOfflineStatuses({db,context:ctx,eventIds:[a]}),[{eventId:a,status:"APLICADO",applied:true}]);
});
