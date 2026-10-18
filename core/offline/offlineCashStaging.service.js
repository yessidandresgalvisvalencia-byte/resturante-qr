"use strict";
// Append-only intent to reconcile cash; NOT a payment capture or cash balance change.
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function stageOfflineCashIntents({db,session,context,plan}){
 if(!db?.collection||session?.inTransaction?.()!==true)fail("OFFLINE_CASH_TRANSACTION_REQUIRED");
 if(!context||![context.empresaId,context.sedeId,context.actorId].every(v=>typeof v==="string"&&ID.test(v)))
  fail("OFFLINE_CASH_AUTH_REQUIRED");
 if(!Array.isArray(plan?.orders)||!plan.orders.length||plan.orders.length>100)fail("OFFLINE_CASH_INVALID_PLAN");
 const ids=new Set();let sum=0n;
 for(const order of plan.orders){
  if(!ULID.test(order?.eventId||"")||ids.has(order.eventId)||typeof order.totalCop!=="string"||
    !/^(0|[1-9][0-9]*)$/.test(order.totalCop))fail("OFFLINE_CASH_INVALID_PLAN");
  ids.add(order.eventId);sum+=BigInt(order.totalCop);
  if(sum>MAX)fail("OFFLINE_CASH_INVALID_PLAN");
 }
 if(sum.toString()!==plan.totalCop)fail("OFFLINE_CASH_TOTAL_CONFLICT");
 const cash=db.collection("gruk_offline_caja_intenciones");
 const indexes=await cash.indexes();
 if(!Array.isArray(indexes)||!indexes.some(i=>i.name==="uniq_offline_cash_tenant_event"&&i.unique===true&&i.sparse!==true&&!i.partialFilterExpression&&
  ["empresaId","sedeId","eventId"].every((k,n)=>Object.keys(i.key||{})[n]===k&&i.key[k]===1)&&Object.keys(i.key||{}).length===3))
   fail("OFFLINE_CASH_UNIQUE_INDEX_REQUIRED");
 const records=[];
 for(const order of plan.orders){
  const key={empresaId:context.empresaId,sedeId:context.sedeId,eventId:order.eventId};
  const payload={...key,actorId:context.actorId,montoCop:order.totalCop,status:"PENDIENTE_CONCILIACION",
    cobrado:false,createdAt:new Date()};
  let result;
  try{result=await cash.updateOne(key,{$setOnInsert:payload},{upsert:true,session});}
  catch(err){if(err?.code===11000)fail("OFFLINE_CASH_CONCURRENT_RETRY_REQUIRED");throw err;}
  if(result.upsertedCount!==1){
   const prior=await cash.findOne(key,{session,projection:{actorId:1,montoCop:1,status:1,cobrado:1}});
   if(!prior||prior.actorId!==payload.actorId||prior.montoCop!==payload.montoCop||
      prior.status!=="PENDIENTE_CONCILIACION"||prior.cobrado!==false)
     fail("OFFLINE_CASH_REPLAY_CONFLICT");
  }
  records.push(Object.freeze({eventId:order.eventId,inserted:result.upsertedCount===1}));
 }
 return Object.freeze({records:Object.freeze(records),totalCop:sum.toString()});
}
module.exports={stageOfflineCashIntents};
