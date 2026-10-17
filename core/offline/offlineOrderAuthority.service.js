"use strict";
// Server-side authorization gate for future offline PEDIDO_REGISTRADO posting.
// No client-supplied prices, stock or company IDs are trusted. No writes here.
function fail(code){const error=new Error(code);error.code=code;throw error;}
async function authorizeOfflineOrder({event,context,db}){
 if(!context||!["empresaId","sedeId","actorId"].every(k=>typeof context[k]==="string"&&k in context&&context[k]))
  fail("OFFLINE_AUTH_REQUIRED");
 if(!event||event.tipo!=="PEDIDO_REGISTRADO"||event.empresaId!==context.empresaId||
    event.sedeId!==context.sedeId||event.actorId!==context.actorId)fail("OFFLINE_TENANT_MISMATCH");
 const payload=event.payload;
 if(!payload||typeof payload.restaurantId!=="string"||!payload.restaurantId||
    typeof payload.menuItemId!=="string"||!/^[a-fA-F0-9]{24}$/.test(payload.menuItemId)||
    !Number.isSafeInteger(payload.mesa)||payload.mesa<=0||
    !Number.isSafeInteger(payload.cantidad)||payload.cantidad<=0)fail("OFFLINE_INVALID_ORDER");
 if(!db?.collection)fail("OFFLINE_DB_REQUIRED");
 const restaurant=await db.collection("restaurantes").findOne({
   restaurantId:payload.restaurantId,empresaId:context.empresaId
 });
 if(!restaurant)fail("OFFLINE_RESTAURANT_FORBIDDEN");
 const menu=await db.collection("menus").findOne({_id:(db.toObjectId ? db.toObjectId(payload.menuItemId) : new (require("mongodb").ObjectId)(payload.menuItemId)),restaurantId:payload.restaurantId});
 if(!menu||menu.disponible!==true||!menu.productoServicioId)fail("OFFLINE_MENU_UNAVAILABLE");
 const product=await db.collection("productoservicios").findOne({_id:menu.productoServicioId,empresaId:restaurant.empresaId,tipo:"producto",activo:true});
 if(!product)fail("OFFLINE_PRODUCT_FORBIDDEN");
 // This adapter is deliberately not connected to the live Pedido collection.
 // Application must resolve Sede and Menu schemas in a transaction before creating a pedido.
 return Object.freeze({
   eventId:event.eventId,empresaId:context.empresaId,sedeId:context.sedeId,
   restaurantId:payload.restaurantId,menuItemId:payload.menuItemId,
   mesa:payload.mesa,cantidad:payload.cantidad,requiresAuthoritativePricing:true,productValidated:true
 });
}
module.exports={authorizeOfflineOrder};
