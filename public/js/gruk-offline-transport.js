/* GRUK offline transport; never posts financial balances or inventory. */
(function(root){
"use strict";
async function synchronize({outbox,token,fetchFn,context,limit=100}) {
 if(!context || ["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||!context[k]))throw Error("SYNC_TENANT_REQUIRED");
 if(!outbox?.listPending || !outbox?.markReceived) throw new Error("SYNC_OUTBOX_REQUIRED");
 if(typeof token!=="string" || !token.trim()) throw new Error("SYNC_AUTH_REQUIRED");
 if(typeof fetchFn!=="function") throw new Error("SYNC_FETCH_REQUIRED");
 const events=await outbox.listPending(limit,context);
 if(events.length===0)return Object.freeze({sent:0,received:0});
 const response=await fetchFn("/api/sync/batch",{
   method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   credentials:"same-origin",body:JSON.stringify({events})
 });
 if(response.status!==202) throw new Error("SYNC_NOT_ACCEPTED");
 const data=await response.json();
 if(!data||data.ok!==true||data.applied!==false||!Array.isArray(data.events)) throw new Error("SYNC_INVALID_ACK");
 const sent=new Map(events.map(e=>[e.eventId,e]));
 if(data.events.length!==sent.size)throw new Error("SYNC_INCOMPLETE_ACK");
 const acknowledged=new Set();
 for(const ack of data.events){
   if(!ack||!sent.has(ack.eventId)||acknowledged.has(ack.eventId)||
     !["RECIBIDO","YA_RECIBIDO"].includes(ack.status))throw new Error("SYNC_INVALID_ACK");
   acknowledged.add(ack.eventId);
 }
 // Mark each accepted item as received, not financially applied. Never delete local records.
 for(const eventId of acknowledged)await outbox.markReceived(eventId,context);
 return Object.freeze({sent:events.length,received:acknowledged.size});
}
const api=Object.freeze({synchronize});
if(typeof module==="object"&&module.exports)module.exports=api;
else root.GRUKOfflineTransport=api;
})(typeof globalThis!=="undefined"?globalThis:this);
