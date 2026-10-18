"use strict";
// Public status must not equate an inbox state with a verified financial posting.
// The same authoritative checks are used by /api/sync/reconciliation.
const {readOfflineReconciliation}=require("./offlineReconciliation.service");
async function readOfflineStatuses({db,context,eventIds}){
 const results=await readOfflineReconciliation({db,context,eventIds});
 return results.map(({eventId,status,applied})=>({eventId,status,applied}));
}
module.exports={readOfflineStatuses};
