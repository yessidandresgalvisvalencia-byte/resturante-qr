"use strict";
// Legacy ProductoServicio uses Mongo ObjectId; the offline posting contract
// must not mistake a SKU/ULID/local ID for a database primary key.
const HEX24=/^[a-fA-F0-9]{24}$/;
function fail(){const e=new Error("OFFLINE_PRODUCT_ID_UNMAPPED");e.code="OFFLINE_PRODUCT_ID_UNMAPPED";throw e;}
function validateOfflineLegacyProductIds(prepared){
 if(!prepared||!Array.isArray(prepared.orders)||prepared.orders.length<1||
    prepared.orders.length>100)fail();
 const productIds=new Set();
 for(let orderIndex=0;orderIndex<prepared.orders.length;orderIndex++){
   if(!Object.hasOwn(prepared.orders,orderIndex))fail();
   const order=prepared.orders[orderIndex];
   if(!order||!Array.isArray(order.items)||order.items.length<1||
      order.items.length>100)fail();
   for(let itemIndex=0;itemIndex<order.items.length;itemIndex++){
     if(!Object.hasOwn(order.items,itemIndex))fail();
     const item=order.items[itemIndex];
     if(typeof item?.productoId!=="string"||!HEX24.test(item.productoId))fail();
     productIds.add(item.productoId.toLowerCase());
   }
 }
 return Object.freeze([...productIds]);
}
module.exports={validateOfflineLegacyProductIds};
