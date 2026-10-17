/* GRUK offline reconciliation: read-only remote verification; never posts a sale. */
(function(root){
"use strict";
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
async function checkStatus({eventIds,token,fetchFn}){
 if(typeof token!=="string"||!token.trim())throw Error("SYNC_AUTH_REQUIRED");
 if(typeof fetchFn!=="function")throw Error("SYNC_FETCH_REQUIRED");
 if(!Array.isArray(eventIds)||eventIds.length<1||eventIds.length>100||
    eventIds.some(id=>typeof id!=="string"||!ULID.test(id))||
    new Set(eventIds).size!==eventIds.length)throw Error("SYNC_INVALID_IDS");
 const response=await fetchFn("/api/sync/status",{
  method:"POST",credentials:"same-origin",
  headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({eventIds})
 });
 if(!response||response.status!==200)throw Error("SYNC_STATUS_UNAVAILABLE");
 const body=await response.json();
 if(!body||body.ok!==true||!Array.isArray(body.events)||body.events.length!==eventIds.length)throw Error("SYNC_STATUS_INVALID");
 const expected=new Set(eventIds),seen=new Set();
 const allowed=new Set(["PENDIENTE","EN_REVISION","APLICADO","RECHAZADO","NO_ENCONTRADO"]);
 for(const entry of body.events){
  if(!entry||!expected.has(entry.eventId)||seen.has(entry.eventId)||
      !allowed.has(entry.status)||typeof entry.applied!=="boolean"||
      entry.applied!==(entry.status==="APLICADO"))throw Error("SYNC_STATUS_INVALID");
  seen.add(entry.eventId);
 }
 return Object.freeze({events:body.events.map(entry=>Object.freeze({eventId:entry.eventId,status:entry.status,applied:entry.applied}))});
}
const api=Object.freeze({checkStatus});
if(typeof module==="object"&&module.exports)module.exports=api;
else root.GRUKOfflineReconcile=api;
})(typeof globalThis!=="undefined"?globalThis:this);
