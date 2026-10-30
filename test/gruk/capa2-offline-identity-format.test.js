"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {synchronize,reconcileReceived}=require("../../public/js/gruk-offline-transport");
const ctx={empresaId:"empresa-A",sedeId:"sede-1",actorId:"actor_1"};
test("Capa 2: empresas, sedes o actores malformados no acceden a outbox ni red",async()=>{
 const bad=[" empresa-A","empresa A","$ne","a.b","a/b","línea","x".repeat(81),"a\nB"];
 for(const field of ["empresaId","sedeId","actorId"]){
  for(const value of bad){
   let reads=0,network=0;
   const outbox={listPending:async()=>{reads++;return [];},markReceived:async()=>true,
    listReceived:async()=>{reads++;return [];},markReconciled:async()=>true};
   const options={outbox,token:"jwt",context:{...ctx,[field]:value},
    fetchFn:async()=>{network++;throw Error("UNEXPECTED_NETWORK");}};
   await assert.rejects(synchronize(options),/SYNC_TENANT_REQUIRED/);
   await assert.rejects(reconcileReceived(options),/SYNC_TENANT_REQUIRED/);
   assert.equal(reads,0);assert.equal(network,0);
  }
 }
});
test("Capa 2: identificadores canónicos siguen permitidos",async()=>{
 const result=await synchronize({outbox:{listPending:async()=>[],markReceived:async()=>true},
  token:"jwt",context:ctx,fetchFn:async()=>{throw Error("UNEXPECTED_NETWORK");}});
 assert.deepEqual(result,{sent:0,received:0});
});
