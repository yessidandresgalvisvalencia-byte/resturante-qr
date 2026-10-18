"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {prepareOfflineOrders}=require("../../core/offline/offlineOrdersBatch.preflight");
const alphabet="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const root="01ARZ3NDEKTSV4RRFFQ69G5FA";
const orders=Array.from({length:20},(_,i)=>({
 eventId:root+alphabet[i],tipo:"PEDIDO_REGISTRADO",
 payload:{localOrderId:"01ARZ3NDEKTSV4RRFFQ69G5F"+alphabet[i]+alphabet[i],
  items:[{productoId:"producto",cantidad:"2",precioUnitarioCop:"1500",totalCop:"3000"}],totalCop:"3000"}
}));
test("20 pedidos offline reconciliados en preflight sin escribir",()=>{
 const result=prepareOfflineOrders(orders);
 assert.equal(result.orders.length,20);
 assert.equal(result.totalCop,"60000");
});
test("pedidos con ULID de orden duplicado no entran a conciliación",()=>{
 assert.throws(()=>prepareOfflineOrders([orders[0],{...orders[1],payload:{...orders[1].payload,localOrderId:orders[0].payload.localOrderId}}]),
 e=>e.code==="OFFLINE_ORDER_BATCH_CONFLICT");
});
test("pedido inconsistente rechaza el lote entero",()=>{
 assert.throws(()=>prepareOfflineOrders([...orders.slice(0,19),{...orders[19],payload:{...orders[19].payload,totalCop:"2999"}}]),
 e=>e.code==="OFFLINE_ORDER_NOT_POSTABLE");
});
