"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {claimReceivedPedido}=require("../../core/offline/offlinePedidoClaim.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const context={empresaId:"A",sedeId:"S",actorId:"U"};
test("claim requires authenticated tenant and transactional session",async()=>{
 await assert.rejects(claimReceivedPedido({db:{collection:()=>{}},context,eventId}),/OFFLINE_TRANSACTION_REQUIRED/);
 await assert.rejects(claimReceivedPedido({db:{collection:()=>{}},session:{withTransaction:async()=>{}},context:{},eventId}),/OFFLINE_AUTH_REQUIRED/);
});
test("claim only updates exact pending order for same actor",async()=>{
 let filter,update;
 const db={collection:()=>({
  findOneAndUpdate:async(f,u)=>{filter=f;update=u;return {status:"EN_REVISION"}},
  findOne:async()=>{throw Error("unexpected")}
 })};
 const result=await claimReceivedPedido({db,context,eventId,session:{withTransaction:async fn=>fn()}});
 assert.equal(result.status,"EN_REVISION");
 assert.equal(filter.empresaId,"A");assert.equal(filter.sedeId,"S");assert.equal(filter.actorId,"U");
 assert.equal(filter.status,"PENDIENTE");assert.equal(filter.tipo,"PEDIDO_REGISTRADO");
 assert.equal(update.$set.status,"EN_REVISION");
});
test("no match remains non-applied and does not create payment",async()=>{
 const db={collection:()=>({findOneAndUpdate:async()=>null,findOne:async()=>null})};
 const result=await claimReceivedPedido({db,context,eventId,session:{withTransaction:async fn=>fn()}});
 assert.deepEqual(result,{eventId,status:"NO_ENCONTRADO"});
});
