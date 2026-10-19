"use strict";
// Deterministic per-product inventory movements from validated offline orders.
// Read-only calculation. Negative stock is preserved to surface offline overselling.
function invalid(){const e=new Error("OFFLINE_STOCK_PLAN_INVALID");e.code="OFFLINE_STOCK_PLAN_INVALID";throw e;}
function calculateOfflineStockDeltas(prepared){
 if(!prepared||!Array.isArray(prepared.orders)||prepared.orders.length<1||
    prepared.orders.length>1000)invalid();
 // Array iteration skips holes; never silently omit an offline order or item.
 if(!Array.from({length:prepared.orders.length},(_,i)=>
    Object.prototype.hasOwnProperty.call(prepared.orders,i)).every(Boolean))invalid();
 let totalItems=0;
 for(const order of prepared.orders){
  if(!order||!Array.isArray(order.items)||order.items.length<1||
     order.items.length>10000||(totalItems+=order.items.length)>10000)invalid();
  if(!Array.from({length:order.items.length},(_,i)=>
     Object.prototype.hasOwnProperty.call(order.items,i)).every(Boolean))invalid();
 }
 const totals=new Map();
 for(const order of prepared.orders){
  for(const item of order.items){
   if(!item||typeof item.productoId!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(item.productoId)||
      typeof item.cantidad!=="string"||item.cantidad.length>16||
      !/^[1-9][0-9]*$/.test(item.cantidad))invalid();
   const delta=BigInt(item.cantidad);
   if(delta>BigInt(Number.MAX_SAFE_INTEGER))invalid();
   const sum=(totals.get(item.productoId)||0n)+delta;
   if(sum>BigInt(Number.MAX_SAFE_INTEGER))invalid();
   totals.set(item.productoId,sum);
  }
 }
 return Object.freeze([...totals].map(([productoId,qty])=>
  Object.freeze({productoId,deltaUnidades:"-"+qty.toString()})));
}
module.exports={calculateOfflineStockDeltas};
