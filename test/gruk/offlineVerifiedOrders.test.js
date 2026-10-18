"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {prepareVerifiedOfflineOrders:prepare}=require("../../core/offline/offlineVerifiedOrders.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const product="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"cajero"};
const event={...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",payload:{
 localOrderId:eventId,items:[{productoId:product,cantidad:"1",precioUnitarioCop:"3000",totalCop:"3000"}],totalCop:"3000"
}};
function db(productFound=true){
 return {collection(name){
  if(name==="gruk_offline_inbox")return {find:q=>({toArray:async()=>[event].filter(e=>e.empresaId===q.empresaId&&e.sedeId===q.sedeId&&e.actorId===q.actorId&&e.status===q.status)})};
  if(name==="productoservicios")return {find:q=>({toArray:async()=>productFound&&q.empresaId===context.empresaId&&q.sedeId===context.sedeId?[{_id:product}]:[]})};
  throw Error("UNEXPECTED_COLLECTION");
 }};
}
test("lectura persistente más validación de producto genera plan sin escrituras",async()=>{
 const result=await prepare({db:db(),context,eventIds:[eventId],objectId:x=>x});
 assert.equal(result.totalCop,"3000");
 assert.deepEqual(result.productIds,[product]);
});
test("no genera plan si el producto está ausente",async()=>{
 await assert.rejects(prepare({db:db(false),context,eventIds:[eventId],objectId:x=>x}),
 e=>e.code==="OFFLINE_PRODUCTS_NOT_AUTHORIZED");
});
test("no genera plan ante contexto de otro tenant",async()=>{
 await assert.rejects(prepare({db:db(),context:{...context,empresaId:"507f191e810c19729de860eb"},eventIds:[eventId],objectId:x=>x}),
 e=>e.code==="OFFLINE_ORDERS_NOT_PENDING");
});
