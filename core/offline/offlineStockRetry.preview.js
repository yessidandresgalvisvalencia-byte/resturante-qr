"use strict";
// Pure reconciliation preview: records already applied must not consume stock twice.
const {previewOfflineStockConflict}=require("./offlineStockConflict.preview");
function previewStockWithAppliedIds({availableUnits,events,appliedEventIds=[]}){
 if(!Array.isArray(appliedEventIds)||appliedEventIds.some(id=>typeof id!=="string")||new Set(appliedEventIds).size!==appliedEventIds.length)throw Error("STOCK_INVALID_APPLIED_IDS");
 if(!Array.isArray(events)||events.length<1||events.length>100)throw Error("STOCK_INVALID_EVENTS");
 const seen=new Set();
 for(const e of events){
   if(!e||typeof e.eventId!=="string"||seen.has(e.eventId))throw Error("STOCK_INVALID_EVENT");
   seen.add(e.eventId);
 }
 const applied=new Set(appliedEventIds);
 const pending=events.filter(e=>!applied.has(e.eventId));
 // Validate all events, including already applied events, before filtering.
 const validated=previewOfflineStockConflict({availableUnits,events});
 const result=pending.length?previewOfflineStockConflict({availableUnits,events:pending}):
   Object.freeze({availableUnits,requestedUnits:0,projectedUnits:availableUnits,hasConflict:false,requiresReview:false});
 return Object.freeze({...result,skippedAlreadyApplied:validated.requestedUnits-result.requestedUnits,pendingEventCount:pending.length});
}
module.exports={previewStockWithAppliedIds};
