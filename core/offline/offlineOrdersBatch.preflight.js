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
    return order;
  });
  return Object.freeze({orders:Object.freeze(normalized),totalCop:total.toString()});
}
module.exports={prepareOfflineOrders};
