"use strict";
// Read-only status by authenticated tenant. Never interprets RECIBIDO as posted.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
async function readOfflineStatuses({db,context,eventIds}) {
 if(!db?.collection || !context || ![context.empresaId,context.sedeId,context.actorId].every(v=>typeof v==="string"&&ID.test(v)))throw Error("OFFLINE_AUTH_REQUIRED");
 if(!Array.isArray(eventIds)||eventIds.length<1||eventIds.length>100||
    eventIds.some(id=>typeof id!=="string"||!ULID.test(id))||
    new Set(eventIds).size!==eventIds.length)throw Error("OFFLINE_INVALID_IDS");
 const records=await db.collection("gruk_offline_inbox").find({
   empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,
   eventId:{$in:eventIds}
 },{projection:{_id:0,eventId:1,status:1}}).toArray();
 const found=new Map(records.map(r=>[r.eventId,r.status]));
 return eventIds.map(eventId=>({
   eventId,status:found.has(eventId)?found.get(eventId):"NO_ENCONTRADO",
   applied:found.get(eventId)==="APLICADO"
 }));
}
module.exports={readOfflineStatuses};
