"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateOfflineOrderForPosting:validate}=require("../../core/offline/offlineOrderPosting.contract");
const {prepareOfflineOrders}=require("../../core/offline/offlineOrdersBatch.preflight");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const orderId="01ARZ3NDEKTSV4RRFFQ69G5FA1";
const productId="507f1f77bcf86cd799439011";
function valid(){
 return {eventId,tipo:"PEDIDO_REGISTRADO",payload:{
  localOrderId:orderId,totalCop:"6000",
  items:[{productoId:productId,cantidad:"2",precioUnitarioCop:"3000",totalCop:"6000"}]
 }};
}
test("Capa 2: ningún ID falsificado con toString supera el preflight financiero",()=>{
 const forged=[
  value=>({$ne:null,toString:()=>value}),
  value=>({$eq:value,toString:()=>value}),
  value=>({toString:()=>value}),
  value=>new String(value),
  value=>[value]
 ];
 for(const field of ["eventId","localOrderId","productoId"]){
  for(const forge of forged){
   const order=valid();
   if(field==="eventId")order.eventId=forge(eventId);
   if(field==="localOrderId")order.payload.localOrderId=forge(orderId);
   if(field==="productoId")order.payload.items[0].productoId=forge(productId);
   assert.throws(()=>validate(order),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
   assert.throws(()=>prepareOfflineOrders([order]),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
  }
 }
});
test("Capa 2: ID válido en texto sigue preservando el total COP sin float",()=>{
 const result=validate(valid());
 assert.equal(result.eventId,eventId);
 assert.equal(result.localOrderId,orderId);
 assert.equal(result.items[0].productoId,productId);
 assert.equal(result.totalCop,"6000");
 assert.equal(prepareOfflineOrders([valid()]).totalCop,"6000");
});
