/* Offline technical order capture: durable inbox event, NEVER a settled sale. */
(function(root){
"use strict";
const ALPHABET="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PRODUCT=/^[0-9a-fA-F]{24}$/;
const SAFE=/^[A-Za-z0-9_-]{1,80}$/;
const MONEY=/^(0|[1-9][0-9]*)$/;
function fail(code){throw Error(code);}
function newUlid(now=Date.now(),cryptoSource=root.crypto){
 if(!Number.isSafeInteger(now)||now<0||now>281474976710655||
   typeof cryptoSource?.getRandomValues!=="function")fail("OFFLINE_CRYPTO_REQUIRED");
 let timestamp=BigInt(now),prefix="";
 for(let i=0;i<10;i++){prefix=ALPHABET[Number(timestamp%32n)]+prefix;timestamp/=32n;}
 const bits=new Uint8Array(16);
 cryptoSource.getRandomValues(bits);
 return prefix+Array.from(bits,b=>ALPHABET[b%32]).join("");
}
function createOfflineOrder({context,deviceId,productoId,cantidad,precioUnitarioCop,
 now=new Date(),cryptoSource=root.crypto}){
 if(!context||[context.empresaId,context.sedeId,context.actorId,deviceId].some(s=>typeof s!=="string"||!SAFE.test(s)))
  fail("OFFLINE_DRAFT_IDENTITY_REQUIRED");
 if(typeof productoId!=="string"||!PRODUCT.test(productoId))fail("OFFLINE_DRAFT_PRODUCT_REQUIRED");
 if(typeof cantidad!=="string"||!MONEY.test(cantidad)||BigInt(cantidad)<1n||
  BigInt(cantidad)>1000n)fail("OFFLINE_DRAFT_QUANTITY");
 if(typeof precioUnitarioCop!=="string"||!MONEY.test(precioUnitarioCop))fail("OFFLINE_DRAFT_PRICE");
 const amount=BigInt(cantidad)*BigInt(precioUnitarioCop);
 if(amount>BigInt(Number.MAX_SAFE_INTEGER))fail("OFFLINE_DRAFT_OVERFLOW");
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail("OFFLINE_DRAFT_DATE");
 const eventId=newUlid(now.getTime(),cryptoSource);
 return Object.freeze({
  eventId,empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId,
  deviceId,tipo:"PEDIDO_REGISTRADO",occurredAt:now.toISOString(),schemaVersion:1,
  payload:{localOrderId:eventId,items:[{productoId:productoId.toLowerCase(),cantidad,
   precioUnitarioCop,totalCop:amount.toString()}],totalCop:amount.toString()}
 });
}
async function saveOfflineOrder({outbox,...input}){
 if(typeof outbox?.putPending!=="function")fail("OFFLINE_DRAFT_OUTBOX_REQUIRED");
 const event=createOfflineOrder(input);
 // Await IndexedDB transaction completion BEFORE presenting the event as saved.
 const saved=await outbox.putPending(event);
 if(saved!==event.eventId)fail("OFFLINE_DRAFT_SAVE_FAILED");
 return Object.freeze({eventId:event.eventId,status:"pending",totalCop:event.payload.totalCop});
}
const api=Object.freeze({newUlid,createOfflineOrder,saveOfflineOrder});
if(typeof module==="object"&&module.exports)module.exports=api;
else root.GRUKOfflineDraft=api;
})(typeof globalThis!=="undefined"?globalThis:this);
