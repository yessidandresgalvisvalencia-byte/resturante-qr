"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {putPending}=require("../../public/js/gruk-offline-outbox");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FAV";
test("outbox refuses events without tenant identity before IndexedDB",async()=>{
 for(const event of [
   {eventId},
   {eventId,empresaId:"a",sedeId:"b"},
   {eventId,empresaId:"a",sedeId:"b",actorId:""}
 ]) await assert.rejects(putPending(event),/OUTBOX_TENANT_REQUIRED/);
});
