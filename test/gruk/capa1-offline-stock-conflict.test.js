"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {previewOfflineStockConflict}=require("../../core/offline/offlineStockConflict.preview");
const events=[{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",deviceId:"tabletA",quantity:1},{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",deviceId:"tabletB",quantity:1}];
test("two offline tablets consume stock 1 -> projected -1, alert and review",()=>{
 const result=previewOfflineStockConflict({availableUnits:1,events});
 assert.deepEqual(result,{availableUnits:1,requestedUnits:2,projectedUnits:-1,hasConflict:true,requiresReview:true});
 assert.ok(Object.isFrozen(result));
});
test("no conflict when available stock covers orders",()=>{
 assert.equal(previewOfflineStockConflict({availableUnits:2,events}).hasConflict,false);
});
test("reject duplicate event or invalid units before any mutation",()=>{
 assert.throws(()=>previewOfflineStockConflict({availableUnits:1,events:[events[0],events[0]]}),/STOCK_INVALID_EVENT/);
 assert.throws(()=>previewOfflineStockConflict({availableUnits:1.5,events}),/STOCK_INVALID_AVAILABLE/);
 assert.throws(()=>previewOfflineStockConflict({availableUnits:1,events:[{...events[0],quantity:0}]}),/STOCK_INVALID_EVENT/);
});
