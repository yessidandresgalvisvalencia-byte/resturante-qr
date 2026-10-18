"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const outbox=require("../../public/js/gruk-offline-outbox.js");
test("offline outbox rejects invalid event identifiers before writing",async()=>{
 for(const event of [null,{}, {eventId:"abc"}, {eventId:"0".repeat(25)+"I"}])
  await assert.rejects(outbox.putPending(event),/OUTBOX_EVENT_ID/);
});
test("offline queue bounds are enforced before database access",async()=>{
 for(const limit of [0,-1,101,1.1,NaN])
  await assert.rejects(outbox.listPending(limit,{empresaId:"A",sedeId:"B",actorId:"C"}),/OUTBOX_LIMIT/);
});
test("offline outbox exports narrow API",()=>{
 assert.deepEqual(Object.keys(outbox).sort(),["listLocal","listPending","listReceived","listStockReservations","markReceived","markReconciled","putPending"]);
 assert.ok(Object.isFrozen(outbox));
});
