"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {synchronize}=require("../../public/js/gruk-offline-transport");
const {listPending,markReceived}=require("../../public/js/gruk-offline-outbox");
test("tenant context required before browsing local outbox",async()=>{
 await assert.rejects(listPending(100),/OUTBOX_TENANT_REQUIRED/);
 await assert.rejects(markReceived("ID"),/OUTBOX_TENANT_REQUIRED/);
});
test("transport rejects missing tenant context before touching outbox",async()=>{
 let touched=false;
 await assert.rejects(synchronize({
   outbox:{listPending:async()=>{touched=true;return[]},markReceived:async()=>{}},
   token:"jwt",fetchFn:async()=>{touched=true;}
 }),/SYNC_TENANT_REQUIRED/);
 assert.equal(touched,false);
});
