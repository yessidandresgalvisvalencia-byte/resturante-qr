"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {acceptOfflineBatch}=require("../../core/offline/offlineInbox.service");
const context={empresaId:"empresa",sedeId:"sede",actorId:"cajero"};
const event={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA0",...context,deviceId:"tablet_1",
 tipo:"PEDIDO_REGISTRADO",occurredAt:"2026-10-20T10:00:00.000Z",
 schemaVersion:1,payload:{pedidoId:"local_1"}};
test("Capa 2: inbox rechaza acuse de escritura desconocido sin afirmar recibido",async()=>{
 for(const response of [null,undefined,{}, {upsertedCount:-1},{upsertedCount:2},
  {upsertedCount:"1"},{acknowledged:false,upsertedCount:0},
  {acknowledged:false,upsertedCount:1}]){
  let reads=0,writes=0;
  const db={collection:()=>({
   findOne:async()=>{reads++;return null;},
   updateOne:async()=>{writes++;return response;}
  })};
  await assert.rejects(acceptOfflineBatch({db,authenticatedContext:context,events:[event]}),
   {code:"OFFLINE_INBOX_WRITE_UNVERIFIED"});
  assert.equal(writes,1);
  assert.equal(reads,1,"No additional replay lookup after uncertain acknowledgement");
 }
});
test("Capa 2: inbox reconoce inserción y reintento con acuse válido",async()=>{
 let saved;
 const db={collection:()=>({
  findOne:async()=>saved||null,
  updateOne:async(key,update)=> {
   if(saved)return {acknowledged:true,upsertedCount:0};
   saved=update.$setOnInsert;
   return {acknowledged:true,upsertedCount:1};
  }
 })};
 const first=await acceptOfflineBatch({db,authenticatedContext:context,events:[event]});
 const second=await acceptOfflineBatch({db,authenticatedContext:context,events:[event]});
 assert.equal(first[0].status,"RECIBIDO");
 assert.equal(second[0].status,"YA_RECIBIDO");
});
