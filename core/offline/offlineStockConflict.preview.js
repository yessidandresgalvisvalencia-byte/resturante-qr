"use strict";
// Pure conflict preview; DOES NOT mutate stock, ledger, orders or cash.
// Quantities are whole units. Negative projected stock remains visible.
function previewOfflineStockConflict({availableUnits,events}) {
 if(!Number.isSafeInteger(availableUnits)||availableUnits<0)throw Error("STOCK_INVALID_AVAILABLE");
 if(!Array.isArray(events)||events.length<1||events.length>100)throw Error("STOCK_INVALID_EVENTS");
 const seen=new Set();let consumed=0;
 for(const e of events){
  if(!e||typeof e.eventId!=="string"||! /^[0-9A-HJKMNP-TV-Z]{26}$/.test(e.eventId)||
     seen.has(e.eventId)||typeof e.deviceId!=="string"||!e.deviceId||
     !Number.isSafeInteger(e.quantity)||e.quantity<=0)throw Error("STOCK_INVALID_EVENT");
  seen.add(e.eventId);
  if(!Number.isSafeInteger(consumed+e.quantity))throw Error("STOCK_QUANTITY_OVERFLOW");
  consumed+=e.quantity;
 }
 const projected=availableUnits-consumed;
 if(!Number.isSafeInteger(projected))throw Error("STOCK_QUANTITY_OVERFLOW");
 return Object.freeze({availableUnits,requestedUnits:consumed,projectedUnits:projected,hasConflict:projected<0,requiresReview:projected<0});
}
module.exports={previewOfflineStockConflict};
