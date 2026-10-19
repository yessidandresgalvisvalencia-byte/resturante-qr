"use strict";
// Deterministic per-product inventory movements from validated offline orders.
// Read-only calculation. Negative stock is preserved to surface offline overselling.
function invalid(){const e=new Error("OFFLINE_STOCK_PLAN_INVALID");e.code="OFFLINE_STOCK_PLAN_INVALID";throw e;}
function calculateOfflineStockDeltas(prepared){
 if(!prepared||!Array.isArray(prepared.orders)||prepared.orders.length<1)invalid();
 const totals=new Map();
 for(const order of prepared.orders){
  if(!order||!Array.isArray(order.items)||order.items.length<1)invalid();
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
