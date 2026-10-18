"use strict";
// Reads tenant-scoped durable inbox entries and prepares posting candidates.
// No financial side effects; POSTING must be implemented in a transaction separately.
const {prepareOfflineOrdersForTenant}=require("./offlineOrdersBatch.preflight");
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function readOfflineOrderCandidates({db,context,eventIds}){
  if(!db?.collection||!context||!["empresaId","sedeId","actorId"].every(k=>typeof context[k]==="string"&&ID.test(context[k])))
    fail("OFFLINE_AUTH_REQUIRED");
  if(!Array.isArray(eventIds)||eventIds.length<1||eventIds.length>100||
    eventIds.some(x=>typeof x!=="string"||!ULID.test(x))||new Set(eventIds).size!==eventIds.length)
    fail("OFFLINE_INVALID_IDS");
  const docs=await db.collection("gruk_offline_inbox").find({
    empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,
    tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",eventId:{$in:eventIds}
  },{projection:{_id:0,eventId:1,empresaId:1,sedeId:1,actorId:1,tipo:1,payload:1}}).toArray();
  if(docs.length!==eventIds.length)fail("OFFLINE_ORDERS_NOT_PENDING");
  const byId=new Map(docs.map(x=>[x.eventId,x]));
  if(byId.size!==eventIds.length)fail("OFFLINE_ORDERS_NOT_PENDING");
  const ordered=eventIds.map(id=>byId.get(id));
  if(ordered.some(x=>!x))fail("OFFLINE_ORDERS_NOT_PENDING");
  return prepareOfflineOrdersForTenant(ordered,context);
}
module.exports={readOfflineOrderCandidates};
