"use strict";
// Public status must not equate an inbox state with a verified financial posting.
// The same authoritative checks are used by /api/sync/reconciliation.
const {readOfflineReconciliation}=require("./offlineReconciliation.service");
const {STATES}=require("./offlineState.contract");
const VALID=new Set([...Object.values(STATES),"NO_ENCONTRADO"]);
function fail(){const e=new Error("OFFLINE_STATUS_EVIDENCE_INVALID");e.code=e.message;throw e;}
async function readOfflineStatuses({db,context,eventIds}){
 const results=await readOfflineReconciliation({db,context,eventIds});
 // Never relay arbitrary or forged inbox states to the tablet as authoritative.
 if(!Array.isArray(results)||results.length!==eventIds.length||results.some((record,i)=>
  !record||record.eventId!==eventIds[i]||!VALID.has(record.status)||
  typeof record.applied!=="boolean"||
  (record.applied===true&&record.status!==STATES.APLICADO)))fail();
 return results.map(({eventId,status,applied})=>({eventId,status,applied}));
}
module.exports={readOfflineStatuses};
