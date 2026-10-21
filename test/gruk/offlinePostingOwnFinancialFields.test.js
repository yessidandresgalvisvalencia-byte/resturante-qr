"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateOfflineOrderForPosting:validate}=require("../../core/offline/offlineOrderPosting.contract");
const {prepareOfflineOrders}=require("../../core/offline/offlineOrdersBatch.preflight");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0",orderId="01ARZ3NDEKTSV4RRFFQ69G5FA1";
function valid(){
 return {eventId:id,tipo:"PEDIDO_REGISTRADO",payload:{
  localOrderId:orderId,totalCop:"6000",
  items:[{productoId:"product1",cantidad:"2",precioUnitarioCop:"3000",totalCop:"6000"}]
 }};
}
function inherited(object,field){
 const value=object[field];
 const out=Object.assign(Object.create({[field]:value}),object);
 delete out[field];
 assert.equal(out[field],value);
 assert.equal(Object.hasOwn(out,field),false);
 return out;
}
test("Capa 2: no se aceptan campos de evento heredados del prototipo",()=>{
 for(const field of ["tipo","eventId","payload"]){
  const forged=inherited(valid(),field);
  assert.throws(()=>validate(forged),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
  assert.throws(()=>prepareOfflineOrders([forged]),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
 }
});
test("Capa 2: no se aceptan identificador, líneas ni total COP heredados",()=>{
 for(const field of ["localOrderId","items","totalCop"]){
  const event=valid();
  event.payload=inherited(event.payload,field);
  assert.throws(()=>validate(event),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
  assert.throws(()=>prepareOfflineOrders([event]),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
 }
});
test("Capa 2: no se aceptan valores de artículos heredados",()=>{
 for(const field of ["productoId","cantidad","precioUnitarioCop","totalCop"]){
  const event=valid();
  event.payload.items[0]=inherited(event.payload.items[0],field);
  assert.throws(()=>validate(event),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
  assert.throws(()=>prepareOfflineOrders([event]),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
 }
});
test("Capa 2: 20 pedidos legítimos mantienen integridad de COP",()=>{
 const events=Array.from({length:20},(_,i)=>{
  const v=valid();
  v.eventId=id.slice(0,-1)+"0123456789ABCDEFGHJKM"[i];
  v.payload.localOrderId=orderId.slice(0,-1)+"0123456789ABCDEFGHJKM"[i];
  return v;
 });
 const result=prepareOfflineOrders(events);
 assert.equal(result.orders.length,20);
 assert.equal(result.totalCop,"120000");
 assert.equal(validate(valid()).totalCop,"6000");
});
