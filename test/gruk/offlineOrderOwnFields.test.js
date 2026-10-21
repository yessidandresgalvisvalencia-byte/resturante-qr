"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateOfflineOrderForPosting:validate}=require("../../core/offline/offlineOrderPosting.contract");
const {prepareOfflineOrders:prepare}=require("../../core/offline/offlineOrdersBatch.preflight");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0",localOrderId="01ARZ3NDEKTSV4RRFFQ69G5FA1";
function valid(){return {tipo:"PEDIDO_REGISTRADO",eventId,payload:{
 localOrderId,totalCop:"6000",items:[{
 productoId:"producto",cantidad:"2",precioUnitarioCop:"3000",totalCop:"6000"
 }]}};}
function inherited(original,field){
 const value=original[field];
 const copy=Object.assign(Object.create({[field]:value}),original);
 delete copy[field];
 assert.equal(copy[field],value);
 assert.equal(Object.hasOwn(copy,field),false);
 return copy;
}
test("Capa 2: evento con tipo evento o payload heredados no se publica",()=>{
 for(const field of ["tipo","eventId","payload"]){
  const event=inherited(valid(),field);
  assert.throws(()=>validate(event),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
  assert.throws(()=>prepare([event]),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
 }
});
test("Capa 2: payload con pedido items o total heredados no se publica",()=>{
 for(const field of ["localOrderId","items","totalCop"]){
  const event=valid();
  event.payload=inherited(event.payload,field);
  assert.throws(()=>validate(event),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
  assert.throws(()=>prepare([event]),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
 }
});
test("Capa 2: líneas con producto cantidad precio o total heredados no se publican",()=>{
 for(const field of ["productoId","cantidad","precioUnitarioCop","totalCop"]){
  const event=valid();
  event.payload.items[0]=inherited(event.payload.items[0],field);
  assert.throws(()=>validate(event),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
  assert.throws(()=>prepare([event]),{code:"OFFLINE_ORDER_NOT_POSTABLE"});
 }
});
test("Capa 2: pedidos legítimos conservan cantidades y totales COP exactos",()=>{
 const actual=validate(valid());
 assert.deepEqual(actual,{eventId,localOrderId,items:[{
  productoId:"producto",cantidad:"2",precioUnitarioCop:"3000",totalCop:"6000"}],totalCop:"6000"});
 assert.equal(prepare([valid()]).totalCop,"6000");
});
