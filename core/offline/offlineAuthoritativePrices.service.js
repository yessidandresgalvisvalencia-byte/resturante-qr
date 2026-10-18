"use strict";
// Fail closed on client-supplied COP prices during administrator-triggered staging.
// Reads authoritative products inside the SAME MongoDB snapshot transaction.
const HEX24=/^[a-fA-F0-9]{24}$/;
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fail(){const e=new Error("OFFLINE_AUTHORITATIVE_PRICE_CONFLICT");e.code=e.message;throw e;}
async function assertOfflineAuthoritativePrices({db,session,context,plan,objectId}){
 if(!db?.collection||session?.inTransaction?.()!==true||typeof objectId!=="function"||
    !HEX24.test(context?.empresaId||"")||!HEX24.test(context?.sedeId||"")||
    !Array.isArray(plan?.orders)||plan.orders.length===0)fail();
 const items=plan.orders.flatMap(order=>order?.items||[]);
 if(!items.length||items.some(item=>!HEX24.test(item?.productoId||"")||
   typeof item.precioUnitarioCop!=="string"||!/^(0|[1-9][0-9]*)$/.test(item.precioUnitarioCop)))fail();
 const ids=[...new Set(items.map(item=>item.productoId.toLowerCase()))];
 const rows=await db.collection("productoservicios").find({
   _id:{$in:ids.map(objectId)},empresaId:objectId(context.empresaId),sedeId:objectId(context.sedeId),activo:true
 },{session,projection:{_id:1,precioVenta:1}}).toArray();
 if(rows.length!==ids.length)fail();
 const prices=new Map();
 for(const row of rows){
   // Legacy product schema stores COP prices as JS numbers; do not round cents.
   if(!Number.isSafeInteger(row?.precioVenta)||row.precioVenta<0)fail();
   const key=String(row._id).toLowerCase();
   if(prices.has(key))fail();
   prices.set(key,BigInt(row.precioVenta));
 }
 for(const item of items){
   const advertised=BigInt(item.precioUnitarioCop);
   if(advertised>MAX||prices.get(item.productoId.toLowerCase())!==advertised)fail();
 }
 return true;
}
module.exports={assertOfflineAuthoritativePrices};
