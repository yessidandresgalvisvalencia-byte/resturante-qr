"use strict";
// Explicitly invoked from trusted server-side workflow only. Does NOT post payment, ledger or stock.
const {authorizeOfflineOrder}=require("./offlineOrderAuthority.service");
function error(code){const e=new Error(code);e.code=code;return e;}
async function prepareOfflinePedido({event,context,db,session}){
 if(!session||typeof session.withTransaction!=="function")throw error("OFFLINE_TRANSACTION_REQUIRED");
 const authorization=await authorizeOfflineOrder({event,context,db});
 if(!authorization.productValidated)throw error("OFFLINE_PRODUCT_FORBIDDEN");
 const {Menu,ProductoServicio}=db.models||{};
 if(!Menu?.findOne||!ProductoServicio?.findOne)throw error("OFFLINE_MODELS_REQUIRED");
 const menu=await Menu.findOne({_id:authorization.menuItemId,restaurantId:authorization.restaurantId,disponible:true}).session(session);
 if(!menu||!menu.productoServicioId)throw error("OFFLINE_MENU_UNAVAILABLE");
 const core=await ProductoServicio.findOne({_id:menu.productoServicioId,empresaId:context.empresaId,tipo:"producto",activo:true}).session(session);
 if(!core)throw error("OFFLINE_PRODUCT_FORBIDDEN");
 // Price validation is a separate requirement: caller MUST NOT persist prepared output as a sale.
 const base=menu.precio;
 if(typeof base!=="number"||!Number.isSafeInteger(base)||base<0)throw error("OFFLINE_PRICE_NOT_INTEGER_COP");
 const quantity=authorization.cantidad;
 if(!Number.isSafeInteger(base*quantity))throw error("OFFLINE_PRICE_OVERFLOW");
 return Object.freeze({offlineEventId:authorization.eventId,empresaId:context.empresaId,sedeId:context.sedeId,
   restaurantId:authorization.restaurantId,menuItemId:authorization.menuItemId,
   productoServicioId:String(menu.productoServicioId),mesa:authorization.mesa,cantidad:quantity,
   precioUnitario:base,precio:base*quantity,estado:"pendiente",estadoPago:"pendiente",requiresTransactionalInsert:true});
}
module.exports={prepareOfflinePedido};
