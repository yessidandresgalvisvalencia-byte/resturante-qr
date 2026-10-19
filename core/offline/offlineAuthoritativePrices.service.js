"use strict";
// Fail closed on client-supplied COP prices during administrator-triggered staging.
// Reads authoritative products inside the SAME MongoDB snapshot transaction.
const HEX24=/^[a-fA-F0-9]{24}$/;
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
const MAX_BATCH_ORDERS=1000,MAX_BATCH_ITEMS=10000;
function fail(){const e=new Error("OFFLINE_AUTHORITATIVE_PRICE_CONFLICT");e.code=e.message;throw e;}
async function assertOfflineAuthoritativePrices({db,session,context,plan,objectId}){
 if(!db?.collection||session?.inTransaction?.()!==true||typeof objectId!=="function"||
    typeof context?.empresaId!=="string"||typeof context?.sedeId!=="string"||
    !HEX24.test(context.empresaId)||!HEX24.test(context.sedeId)||
    !Array.isArray(plan?.orders)||plan.orders.length===0||
    plan.orders.length>MAX_BATCH_ORDERS)fail();
 // Every order must contain a nonempty item array; never silently skip malformed orders.
 if(!Array.from({length:plan.orders.length},(_,i)=>Object.prototype.hasOwnProperty.call(plan.orders,i)).every(Boolean))fail();
 let totalItems=0;
 for(const order of plan.orders){
  if(!order||!Array.isArray(order.items)||order.items.length===0||
     order.items.length>MAX_BATCH_ITEMS||
     (totalItems+=order.items.length)>MAX_BATCH_ITEMS||
     !Array.from({length:order.items.length},(_,i)=>Object.prototype.hasOwnProperty.call(order.items,i)).every(Boolean))fail();
 }
 const items=plan.orders.flatMap(order=>order.items);
 if(!items.length||items.some(item=>typeof item?.productoId!=="string"||
   !HEX24.test(item.productoId)||
   typeof item.precioUnitarioCop!=="string"||item.precioUnitarioCop.length>16||
   !/^(0|[1-9][0-9]*)$/.test(item.precioUnitarioCop)||BigInt(item.precioUnitarioCop)>MAX))fail();
 const ids=[...new Set(items.map(item=>item.productoId.toLowerCase()))];
 // Reject a converter that redirects a scoped lookup to a different identity.
 const asId=value=>{
  let converted;
  try{converted=objectId(value);}catch(_error){fail();}
  if(converted===null||converted===undefined||
    String(converted).toLowerCase()!==value.toLowerCase())fail();
  return converted;
 };
 const query={_id:{$in:ids.map(asId)},empresaId:asId(context.empresaId),
  sedeId:asId(context.sedeId),activo:true};
 const rows=await db.collection("productoservicios").find(query,
  {session,projection:{_id:1,empresaId:1,sedeId:1,activo:1,precioVenta:1}}).toArray();
 if(!Array.isArray(rows)||rows.length!==ids.length)fail();
 const prices=new Map();
 for(const row of rows){
   // Legacy product schema stores COP prices as JS numbers; do not round cents.
   if(String(row?.empresaId).toLowerCase()!==context.empresaId.toLowerCase()||
      String(row?.sedeId).toLowerCase()!==context.sedeId.toLowerCase()||
      row?.activo!==true||!Number.isSafeInteger(row?.precioVenta)||row.precioVenta<0)fail();
   const key=String(row._id).toLowerCase();
   if(!ids.includes(key)||prices.has(key))fail();
   prices.set(key,BigInt(row.precioVenta));
 }
 for(const item of items){
   const advertised=BigInt(item.precioUnitarioCop);
   if(advertised>MAX||prices.get(item.productoId.toLowerCase())!==advertised)fail();
 }
 return true;
}
module.exports={assertOfflineAuthoritativePrices};
