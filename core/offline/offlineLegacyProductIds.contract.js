"use strict";
// Legacy ProductoServicio uses Mongo ObjectId; the offline posting contract
// must not mistake a SKU/ULID/local ID for a database primary key.
const HEX24=/^[a-fA-F0-9]{24}$/;
function fail(){const e=new Error("OFFLINE_PRODUCT_ID_UNMAPPED");e.code="OFFLINE_PRODUCT_ID_UNMAPPED";throw e;}
function validateOfflineLegacyProductIds(prepared){
 if(!prepared||!Array.isArray(prepared.orders)||prepared.orders.length<1)fail();
 const productIds=new Set();
 for(const order of prepared.orders){
   if(!order||!Array.isArray(order.items)||order.items.length<1)fail();
   for(const item of order.items){
     if(typeof item?.productoId!=="string"||!HEX24.test(item.productoId))fail();
     productIds.add(item.productoId.toLowerCase());
   }
 }
 return Object.freeze([...productIds]);
}
module.exports={validateOfflineLegacyProductIds};
