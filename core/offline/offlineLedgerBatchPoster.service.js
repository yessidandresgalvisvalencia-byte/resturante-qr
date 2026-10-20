"use strict";
// Explicit ledger-only batch writer. Call only AFTER sales, stock and cash writers
// have succeeded in the SAME transaction. Never wired to the sync HTTP route.
const {appendOfflineLedgerEvent}=require("./offlineLedgerWriter.service");
function fail(){const e=new Error("OFFLINE_LEDGER_BATCH_INVALID");e.code=e.message;throw e;}
async function postOfflineLedgerBatch({db,session,context,ledgerMovements}){
 const ID=/^[A-Za-z0-9_-]{1,80}$/,ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
 if(typeof db?.collection!=="function"||!context||
   ![context.empresaId,context.sedeId,context.actorId].every(value=>
     typeof value==="string"&&ID.test(value)))fail();
 if(!session||typeof session.inTransaction!=="function"||session.inTransaction()!==true||
 !Array.isArray(ledgerMovements)||ledgerMovements.length===0||ledgerMovements.length>100||
 !Array.from({length:ledgerMovements.length},(_,i)=>Object.hasOwn(ledgerMovements,i)).every(Boolean))fail();
 const seen=new Set();let total=0n;
 for(const m of ledgerMovements){
  if(!m||typeof m.eventId!=="string"||!ULID.test(m.eventId)||seen.has(m.eventId)||
     m.tipo!=="VENTA_OFFLINE"||typeof m.montoCop!=="string"||
     m.montoCop.length>16||!/^(0|[1-9][0-9]*)$/.test(m.montoCop))fail();
  seen.add(m.eventId);total+=BigInt(m.montoCop);
  if(total>BigInt(Number.MAX_SAFE_INTEGER))fail();
 }
 const entries=[];
 for(const m of ledgerMovements){
  entries.push(await appendOfflineLedgerEvent({db,session,context,eventId:m.eventId,movement:{tipo:m.tipo,montoCop:m.montoCop}}));
 }
 return Object.freeze({entries:Object.freeze(entries),totalCop:total.toString()});
}
module.exports={postOfflineLedgerBatch};
