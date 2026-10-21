"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readOfflineOrderCandidates}=require("../../core/offline/offlinePostingCandidates.service");
const context={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
function fake(rows){
 let count=0,options;
 return {get count(){return count;},get options(){return options;},db:{collection(name){
  assert.equal(name,"gruk_offline_inbox");
  return {find(query,opts){
   count++;options=opts;
   assert.equal(query.empresaId,context.empresaId);
   assert.equal(query.sedeId,context.sedeId);
   assert.equal(query.actorId,context.actorId);
   assert.equal(query.status,"PENDIENTE");
   assert.deepEqual(query.eventId,{$in:[eventId]});
   return {toArray:async()=>rows};
  }};
 }}};
}
test("Capa 2: candidatos offline acotan la lectura de MongoDB",async()=>{
 const fixture=fake([]);
 await assert.rejects(readOfflineOrderCandidates({db:fixture.db,context,eventIds:[eventId]}),
  {code:"OFFLINE_ORDERS_NOT_PENDING"});
 assert.equal(fixture.count,1);
 assert.equal(fixture.options.limit,2);
});
test("Capa 2: no se acepta un arreglo disperso aunque declare cantidad correcta",async()=>{
 const sparse=new Array(1);
 const fixture=fake(sparse);
 await assert.rejects(readOfflineOrderCandidates({db:fixture.db,context,eventIds:[eventId]}),
  {code:"OFFLINE_ORDERS_NOT_PENDING"});
 assert.equal(fixture.count,1);
});
test("Capa 2: respuesta masiva no puede publicar pedidos fuera de lote",async()=>{
 const doc={...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",payload:{}};
 const fixture=fake(Array.from({length:101},()=>doc));
 await assert.rejects(readOfflineOrderCandidates({db:fixture.db,context,eventIds:[eventId]}),
  {code:"OFFLINE_ORDERS_NOT_PENDING"});
});
test("Capa 2: sin identidad de actor no se consulta Mongo",async()=>{
 let count=0;const db={collection(){count++;throw Error("SHOULD_NOT_QUERY");}};
 await assert.rejects(readOfflineOrderCandidates({db,context:{...context,actorId:null},eventIds:[eventId]}),
  {code:"OFFLINE_AUTH_REQUIRED"});
 assert.equal(count,0);
});
