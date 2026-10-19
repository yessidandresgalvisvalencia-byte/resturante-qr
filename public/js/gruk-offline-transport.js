/* GRUK offline transport; never posts financial balances or inventory. */
(function(root){
"use strict";
async function synchronize({outbox,token,fetchFn,context,limit=100}) {
 if(!context || ["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||!context[k]))throw Error("SYNC_TENANT_REQUIRED");
 if(!outbox?.listPending || !outbox?.markReceived) throw new Error("SYNC_OUTBOX_REQUIRED");
 if(typeof token!=="string" || !token.trim()) throw new Error("SYNC_AUTH_REQUIRED");
 if(typeof fetchFn!=="function") throw new Error("SYNC_FETCH_REQUIRED");
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("SYNC_LIMIT");
 const events=await outbox.listPending(limit,context);
 if(!Array.isArray(events)||events.length>limit||
    events.some(e=>typeof e?.eventId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(e.eventId))||
    new Set(events.map(e=>e.eventId)).size!==events.length)
   throw Error("SYNC_INVALID_LOCAL_EVENTS");
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
 for(const eventId of acknowledged){
   const persisted=await outbox.markReceived(eventId,context);
   if(persisted!==true)throw new Error("SYNC_LOCAL_ACK_NOT_PERSISTED");
 }
 return Object.freeze({sent:events.length,received:acknowledged.size});
}

// Drain the durable outbox in bounded, server-idempotent pages. A failure stops
// immediately; unacknowledged events stay pending for an operator retry.
async function synchronizeAll({outbox,token,fetchFn,context,limit=100,maxBatches=100}) {
 if(!Number.isInteger(limit)||limit<1||limit>100||
    !Number.isInteger(maxBatches)||maxBatches<1||maxBatches>100)
   throw Error("SYNC_LIMIT");
 let sent=0,received=0,batches=0;
 while(batches<maxBatches){
  const result=await synchronize({outbox,token,fetchFn,context,limit});
  if(result.sent===0)return Object.freeze({sent,received,batches,complete:true});
  sent+=result.sent;received+=result.received;batches++;
  if(result.sent<limit)return Object.freeze({sent,received,batches,complete:true});
 }
 // An exact full final batch may leave more local events; do not claim drained.
 return Object.freeze({sent,received,batches,complete:false});
}

async function reconcileReceived({outbox,token,fetchFn,context,limit=100}) {
 if(!context||["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||!context[k]))throw Error("SYNC_TENANT_REQUIRED");
 if(typeof outbox?.listReceived!=="function"||typeof outbox?.markReconciled!=="function")throw Error("SYNC_OUTBOX_REQUIRED");
 if(typeof token!=="string"||!token.trim())throw Error("SYNC_AUTH_REQUIRED");
 if(typeof fetchFn!=="function")throw Error("SYNC_FETCH_REQUIRED");
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("SYNC_LIMIT");
 const received=await outbox.listReceived(limit,context);
 if(received.length===0)return Object.freeze({checked:0,updated:0});
 const ids=received.map(x=>x?.eventId);
 if(ids.some(x=>typeof x!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(x))||
   new Set(ids).size!==ids.length)throw Error("SYNC_INVALID_LOCAL_EVENTS");
 const response=await fetchFn("/api/sync/reconciliation",{
  method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  credentials:"same-origin",cache:"no-store",body:JSON.stringify({eventIds:ids})
 });
 if(response.status!==200)throw Error("SYNC_RECONCILIATION_UNAVAILABLE");
 const result=await response.json();
 if(!result||result.ok!==true||result.readOnly!==true||!Array.isArray(result.events)||
    result.events.length!==ids.length)throw Error("SYNC_INVALID_RECONCILIATION");
 const expected=new Set(ids),validated=new Set();
 for(const event of result.events){
  if(!event||!expected.has(event.eventId)||validated.has(event.eventId)||
     typeof event.applied!=="boolean"||typeof event.staged!=="boolean"||
     typeof event.financiallyReconciled!=="boolean"||
     !["PENDIENTE","EN_REVISION","APLICADO","RECHAZADO","NO_ENCONTRADO"].includes(event.status)||
     (event.applied&&(event.status!=="APLICADO"||!event.financiallyReconciled))||
     (event.financiallyReconciled&&!event.staged)||
     (event.status==="APLICADO"&&!event.applied))
    throw Error("SYNC_INVALID_RECONCILIATION");
  validated.add(event.eventId);
 }
 let updated=0;
 for(const event of result.events){
  // Ambiguous missing remote identity must not overwrite the local receipt.
  if(event.status==="NO_ENCONTRADO")continue;
  if(await outbox.markReconciled(event.eventId,context,event)===true)updated++;
 }
 return Object.freeze({checked:ids.length,updated});
}
const api=Object.freeze({synchronize,synchronizeAll,reconcileReceived});
if(typeof module==="object"&&module.exports)module.exports=api;
else root.GRUKOfflineTransport=api;
})(typeof globalThis!=="undefined"?globalThis:this);
