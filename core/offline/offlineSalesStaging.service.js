"use strict";
// Offline sales staging journal: integer COP strings, ULID idempotency.
// Not the legacy Mongoose Venta collection; not yet a paid fiscal sale.
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function stageOfflineSales({db,session,context,plan}){
 if(!db?.collection||session?.inTransaction?.()!==true)fail("OFFLINE_SALES_TRANSACTION_REQUIRED");
 if(!context||![context.empresaId,context.sedeId,context.actorId].every(x=>typeof x==="string"&&ID.test(x)))fail("OFFLINE_SALES_AUTH_REQUIRED");
 if(!Array.isArray(plan?.orders)||plan.orders.length<1||plan.orders.length>100)fail("OFFLINE_SALES_INVALID_PLAN");
 let total=0n;const ids=new Set();
 for(const order of plan.orders){
  if(!ULID.test(order?.eventId||"")||!ULID.test(order?.localOrderId||"")||ids.has(order.eventId)||
     typeof order.totalCop!=="string"||!/^(0|[1-9][0-9]*)$/.test(order.totalCop))fail("OFFLINE_SALES_INVALID_PLAN");
  total+=BigInt(order.totalCop);ids.add(order.eventId);
  if(total>MAX)fail("OFFLINE_SALES_INVALID_PLAN");
 }
 if(total.toString()!==plan.totalCop)fail("OFFLINE_SALES_TOTAL_CONFLICT");
 const sales=db.collection("gruk_offline_ventas");
 // A unique tenant/event index must exist before any write.
 const indexes=await sales.indexes();
 if(!indexes.some(i=>i.name==="uniq_offline_sale_tenant_event"&&i.unique===true&&
   ["empresaId","sedeId","eventId"].every((k,n)=>Object.keys(i.key||{})[n]===k&&i.key[k]===1)&&Object.keys(i.key||{}).length===3))
   fail("OFFLINE_SALES_UNIQUE_INDEX_REQUIRED");
 const records=[];
 for(const order of plan.orders){
  const key={empresaId:context.empresaId,sedeId:context.sedeId,eventId:order.eventId};
  const payload={...key,actorId:context.actorId,localOrderId:order.localOrderId,totalCop:order.totalCop,
    items:order.items,status:"PENDIENTE_CONTABILIZACION",createdAt:new Date()};
  let result;
  try{result=await sales.updateOne(key,{$setOnInsert:payload},{upsert:true,session});}
  catch(e){if(e?.code===11000)fail("OFFLINE_SALES_CONCURRENT_RETRY_REQUIRED");throw e;}
  if(result.upsertedCount!==1){
   const prior=await sales.findOne(key,{session,projection:{actorId:1,localOrderId:1,totalCop:1,items:1,status:1}});
   if(!prior||prior.actorId!==payload.actorId||prior.localOrderId!==payload.localOrderId||
     prior.totalCop!==payload.totalCop||JSON.stringify(prior.items)!==JSON.stringify(payload.items)||
     prior.status!=="PENDIENTE_CONTABILIZACION")fail("OFFLINE_SALES_REPLAY_CONFLICT");
  }
  records.push({eventId:order.eventId,inserted:result.upsertedCount===1});
 }
 return Object.freeze({records:Object.freeze(records),totalCop:total.toString()});
}
module.exports={stageOfflineSales};
