"use strict";
// Financial preflight of offline orders only. Does not post sales, inventory or cash.
const {validateOfflineOrderForPosting}=require("./offlineOrderPosting.contract");
function fail(){const e=new Error("OFFLINE_ORDER_BATCH_CONFLICT");e.code="OFFLINE_ORDER_BATCH_CONFLICT";throw e;}
function prepareOfflineOrders(events){
  if(!Array.isArray(events)||events.length<1||events.length>100)fail();
  const ids=new Set(),orders=new Set();
  let total=0n;
  const normalized=events.map(event=>{
    const order=validateOfflineOrderForPosting(event);
    if(ids.has(order.eventId)||orders.has(order.localOrderId))fail();
    ids.add(order.eventId);orders.add(order.localOrderId);
    total+=BigInt(order.totalCop);
    if(total>BigInt(Number.MAX_SAFE_INTEGER))fail();
    return order;
  });
  return Object.freeze({orders:Object.freeze(normalized),totalCop:total.toString()});
}
// Strict, authenticated scope is mandatory at the domain posting boundary.
function prepareOfflineOrdersForTenant(events, authenticatedContext){
  const ID=/^[A-Za-z0-9_-]{1,80}$/;
  if(!authenticatedContext||!["empresaId","sedeId","actorId"].every(k=>
    typeof authenticatedContext[k]==="string"&&ID.test(authenticatedContext[k])))fail();
  if(!Array.isArray(events)||events.length<1||events.length>100)fail();
  for(const event of events){
    if(!event||event.empresaId!==authenticatedContext.empresaId||
      event.sedeId!==authenticatedContext.sedeId||
      event.actorId!==authenticatedContext.actorId)fail();
  }
  return prepareOfflineOrders(events);
}
module.exports={prepareOfflineOrders,prepareOfflineOrdersForTenant};
