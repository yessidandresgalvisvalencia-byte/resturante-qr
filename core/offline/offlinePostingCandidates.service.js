"use strict";
// Reads tenant-scoped durable inbox entries and prepares posting candidates.
// No financial side effects; POSTING must be implemented in a transaction separately.
const {prepareOfflineOrdersForTenant}=require("./offlineOrdersBatch.preflight");
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function readOfflineOrderCandidates({db,context,eventIds,session}){
  // Snapshot only own data properties: accessor getters may mutate tenant
  // identity between validation, inbox lookup and financial preflight.
  if(!db?.collection||!context||typeof context!=="object")
    fail("OFFLINE_AUTH_REQUIRED");
  const identity={};
  for(const key of ["empresaId","sedeId","actorId"]){
    const descriptor=Object.getOwnPropertyDescriptor(context,key);
    if(!descriptor||!("value" in descriptor)||typeof descriptor.value!=="string"||
      !ID.test(descriptor.value))fail("OFFLINE_AUTH_REQUIRED");
    identity[key]=descriptor.value;
  }
  if(!Array.isArray(eventIds)||eventIds.length<1||eventIds.length>100||
    !Array.from({length:eventIds.length},(_,i)=>Object.hasOwn(eventIds,i)).every(Boolean)||
    eventIds.some(x=>typeof x!=="string"||!ULID.test(x))||new Set(eventIds).size!==eventIds.length)
    fail("OFFLINE_INVALID_IDS");
  const docs=await db.collection("gruk_offline_inbox").find({
    empresaId:identity.empresaId,sedeId:identity.sedeId,actorId:identity.actorId,
    tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",eventId:{$in:eventIds}
  },{projection:{_id:0,eventId:1,empresaId:1,sedeId:1,actorId:1,tipo:1,status:1,payload:1},limit:eventIds.length+1,...(session?{session}:{})}).toArray();
  if(!Array.isArray(docs)||docs.length!==eventIds.length||
    !Array.from({length:docs.length},(_,i)=>Object.hasOwn(docs,i)).every(Boolean))
    fail("OFFLINE_ORDERS_NOT_PENDING");
  // Never execute a Mongo adapter's accessors while checking tenant identity.
  // Snapshot every projected field once, then validate and post only the snapshot.
  const checked=docs.map(record=>{
    if(!record||typeof record!=="object"||Array.isArray(record))
      fail("OFFLINE_ORDERS_NOT_PENDING");
    const snapshot={};
    for(const key of ["eventId","empresaId","sedeId","actorId","tipo","status","payload"]){
      const descriptor=Object.getOwnPropertyDescriptor(record,key);
      if(!descriptor||!("value" in descriptor))
        fail("OFFLINE_ORDERS_NOT_PENDING");
      snapshot[key]=descriptor.value;
    }
    if(snapshot.empresaId!==identity.empresaId||snapshot.sedeId!==identity.sedeId||
       snapshot.actorId!==identity.actorId||snapshot.tipo!=="PEDIDO_REGISTRADO"||
       snapshot.status!=="PENDIENTE"||!eventIds.includes(snapshot.eventId))
      fail("OFFLINE_ORDERS_NOT_PENDING");
    return snapshot;
  });
  const byId=new Map(checked.map(x=>[x.eventId,x]));
  if(byId.size!==eventIds.length)fail("OFFLINE_ORDERS_NOT_PENDING");
  const ordered=eventIds.map(id=>byId.get(id));
  if(ordered.some(x=>!x))fail("OFFLINE_ORDERS_NOT_PENDING");
  return prepareOfflineOrdersForTenant(ordered,identity);
}
module.exports={readOfflineOrderCandidates};
