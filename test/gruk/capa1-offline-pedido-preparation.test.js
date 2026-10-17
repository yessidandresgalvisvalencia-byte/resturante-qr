"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {prepareOfflinePedido}=require("../../core/offline/offlinePedidoPreparation.service");
const context={empresaId:"A",sedeId:"S",actorId:"U"};
const event={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",tipo:"PEDIDO_REGISTRADO",...context,payload:{restaurantId:"r",menuItemId:"507f1f77bcf86cd799439011",mesa:1,cantidad:2,precio:1}};
const session={withTransaction:async fn=>fn()};
function db(price=5000){
 const c={restaurantes:{empresaId:"A"},menus:{disponible:true,productoServicioId:"core1"},productoservicios:{activo:true}};
 return {toObjectId:id=>id,collection:name=>({findOne:async()=>c[name]}),models:{
  Menu:{findOne:()=>({session:async()=>({productoServicioId:"core1",precio:price})})},
  ProductoServicio:{findOne:()=>({session:async()=>({activo:true})})}
 }};
}
test("price derived from server catalog, never from offline client",async()=>{
 const p=await prepareOfflinePedido({event,context,db:db(),session});
 assert.equal(p.precio,10000);assert.equal(p.precioUnitario,5000);
 assert.equal(p.estadoPago,"pendiente");assert.equal(p.requiresTransactionalInsert,true);
});
test("no session or fractional money rejects",async()=>{
 await assert.rejects(prepareOfflinePedido({event,context,db:db()}),/OFFLINE_TRANSACTION_REQUIRED/);
 await assert.rejects(prepareOfflinePedido({event,context,db:db(1.5),session}),/OFFLINE_PRICE_NOT_INTEGER_COP/);
});
