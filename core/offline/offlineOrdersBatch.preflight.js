"use strict";
// Financial preflight of offline orders only. Does not post sales, inventory or cash.
const {validateOfflineOrderForPosting}=require("./offlineOrderPosting.contract");
function fail(){const e=new Error("OFFLINE_ORDER_BATCH_CONFLICT");e.code="OFFLINE_ORDER_BATCH_CONFLICT";throw e;}
function captureEvents(events){
  if(!Array.isArray(events)||events.length<1||events.length>100)fail();
  const captured=[];
  for(let i=0;i<events.length;i++){
    const descriptor=Object.getOwnPropertyDescriptor(events,String(i));
    if(!descriptor||!("value" in descriptor))fail();
    captured.push(descriptor.value);
  }
  return captured;
}
function prepareOfflineOrders(events){
  const captured=captureEvents(events);
  const ids=new Set(),orders=new Set();
  let total=0n;
  const normalized=captured.map(event=>{
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
  if(!authenticatedContext||typeof authenticatedContext!=="object")fail();
  const identity={};
  for(const key of ["empresaId","sedeId","actorId"]){
    const descriptor=Object.getOwnPropertyDescriptor(authenticatedContext,key);
    if(!descriptor||!("value" in descriptor)||
       typeof descriptor.value!=="string"||!ID.test(descriptor.value))fail();
    identity[key]=descriptor.value;
  }
  const captured=captureEvents(events);
  for(const event of captured){
    if(!event||typeof event!=="object"||Array.isArray(event))fail();
    // Reject accessors before the domain validator reads any financial payload.
    for(const key of ["empresaId","sedeId","actorId"]){
      const descriptor=Object.getOwnPropertyDescriptor(event,key);
      if(!descriptor||!("value" in descriptor)||descriptor.value!==identity[key])fail();
    }
  }
  return prepareOfflineOrders(captured);
}
module.exports={prepareOfflineOrders,prepareOfflineOrdersForTenant};
