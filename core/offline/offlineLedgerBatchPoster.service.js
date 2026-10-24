"use strict";
// Explicit ledger-only batch writer. Call only AFTER sales, stock and cash writers
// have succeeded in the SAME transaction. Never wired to the sync HTTP route.
const {appendOfflineLedgerEvent}=require("./offlineLedgerWriter.service");
const ID=/^[A-Za-z0-9_-]{1,80}$/,ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
function fail(){const e=new Error("OFFLINE_LEDGER_BATCH_INVALID");e.code=e.message;throw e;}
function own(record,key){
 if(!record||typeof record!=="object"||Array.isArray(record))fail();
 const descriptor=Object.getOwnPropertyDescriptor(record,key);
 if(!descriptor||!("value" in descriptor))fail();
 return descriptor.value;
}
async function postOfflineLedgerBatch({db,session,context,ledgerMovements}){
 // A caller may mutate input objects while Mongo operations are awaited.
 // Snapshot the authenticated tenant and every movement before any DB access.
 const identity={};
 for(const key of ["empresaId","sedeId","actorId"]){
  const value=own(context,key);
  if(typeof value!=="string"||!ID.test(value))fail();
  identity[key]=value;
 }
 if(!session||typeof session.inTransaction!=="function"||session.inTransaction()!==true||
    !Array.isArray(ledgerMovements)||ledgerMovements.length===0||ledgerMovements.length>100)fail();
 const seen=new Set(),movements=[];
 let total=0n;
 for(let i=0;i<ledgerMovements.length;i++){
  const descriptor=Object.getOwnPropertyDescriptor(ledgerMovements,String(i));
  if(!descriptor||!("value" in descriptor))fail();
  const movement=descriptor.value;
  const eventId=own(movement,"eventId");
  const tipo=own(movement,"tipo");
  const montoCop=own(movement,"montoCop");
  if(typeof eventId!=="string"||!ULID.test(eventId)||seen.has(eventId)||
     tipo!=="VENTA_OFFLINE"||typeof montoCop!=="string"||
     montoCop.length>16||!/^(0|[1-9][0-9]*)$/.test(montoCop))fail();
  seen.add(eventId);
  total+=BigInt(montoCop);
  if(total>BigInt(Number.MAX_SAFE_INTEGER))fail();
  movements.push(Object.freeze({eventId,tipo,montoCop}));
 }
 if(!db||typeof db.collection!=="function")fail();
 const snapshot=Object.freeze(identity);
 const entries=[];
 for(const m of movements){
  entries.push(await appendOfflineLedgerEvent({
   db,session,context:snapshot,eventId:m.eventId,
   movement:{tipo:m.tipo,montoCop:m.montoCop}
  }));
 }
 return Object.freeze({entries:Object.freeze(entries),totalCop:total.toString()});
}
module.exports={postOfflineLedgerBatch};
