"use strict";
// Pure one-event-per-order ledger plan. Not a settlement or journal write.
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fail(){const e=new Error("OFFLINE_LEDGER_PLAN_CONFLICT");e.code=e.message;throw e;}
function buildOfflineLedgerPlan(plan){
 if(!plan||!Array.isArray(plan.orders)||!plan.orders.length||
  typeof plan.totalCop!=="string"||!/^(0|[1-9][0-9]*)$/.test(plan.totalCop))fail();
 let sum=0n;const seen=new Set();
 const movements=plan.orders.map(order=>{
  if(!order||!ULID.test(order.eventId||"")||seen.has(order.eventId)||
    typeof order.totalCop!=="string"||!/^(0|[1-9][0-9]*)$/.test(order.totalCop))fail();
  const amount=BigInt(order.totalCop);
  if(amount>MAX)fail();
  sum+=amount;if(sum>MAX)fail();
  seen.add(order.eventId);
  return Object.freeze({eventId:order.eventId,tipo:"VENTA_OFFLINE",montoCop:amount.toString()});
 });
 if(sum!==BigInt(plan.totalCop))fail();
 return Object.freeze(movements);
}
module.exports={buildOfflineLedgerPlan};
