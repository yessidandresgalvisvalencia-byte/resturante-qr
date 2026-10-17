"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {previewStockWithAppliedIds}=require("../../core/offline/offlineStockRetry.preview");
const a={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",deviceId:"tabletA",quantity:1};
const b={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",deviceId:"tabletB",quantity:1};
test("already applied offline sale is never counted twice in stock preview",()=>{
 const result=previewStockWithAppliedIds({availableUnits:1,events:[a,b],appliedEventIds:[a.eventId]});
 assert.deepEqual(result,{availableUnits:1,requestedUnits:1,projectedUnits:0,hasConflict:false,requiresReview:false,skippedAlreadyApplied:1,pendingEventCount:1});
});
test("two pending tablets on stock 1 expose minus one",()=>{
 const result=previewStockWithAppliedIds({availableUnits:1,events:[a,b]});
 assert.equal(result.projectedUnits,-1);
 assert.equal(result.requiresReview,true);
});
test("duplicates and invalid entries fail closed",()=>{
 assert.throws(()=>previewStockWithAppliedIds({availableUnits:1,events:[a,a]}),/STOCK_INVALID_EVENT/);
 assert.throws(()=>previewStockWithAppliedIds({availableUnits:1,events:[{...a,quantity:-1}],appliedEventIds:[a.eventId]}),/STOCK_INVALID_EVENT/);
});
