"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {validateBatch} = require("../../core/offline/offlineBatch.contract");
const tenant = {empresaId:"empresaA",sedeId:"sede1",actorId:"usuario1"};
const event = {eventId:"01K7R00YFBPZ7KYP62F4BXM2JN",empresaId:"empresaA",sedeId:"sede1",actorId:"usuario1",deviceId:"caja1",tipo:"VENTA_REGISTRADA",occurredAt:"2026-10-17T12:00:00.000Z",schemaVersion:1,payload:{ventaId:"venta1"}};
test("offline: accepts valid same-tenant event",()=>{assert.equal(validateBatch([event],tenant).length,1);});
test("offline: rejects cross-company and cross-branch events",()=>{assert.throws(()=>validateBatch([{...event,empresaId:"empresaB"}],tenant),/OFFLINE_TENANT_MISMATCH/);assert.throws(()=>validateBatch([{...event,sedeId:"sede2"}],tenant),/OFFLINE_TENANT_MISMATCH/);});
test("offline: rejects actor spoofing, duplicates, and unknown event types",()=>{assert.throws(()=>validateBatch([{...event,actorId:"otro"}],tenant),/OFFLINE_TENANT_MISMATCH/);assert.throws(()=>validateBatch([event,event],tenant),/OFFLINE_DUPLICATE_EVENT/);assert.throws(()=>validateBatch([{...event,tipo:"PAGO_TARJETA_APROBADO"}],tenant),/OFFLINE_INVALID_TYPE/);});
test("offline: rejects missing authentication and unsupported fields",()=>{assert.throws(()=>validateBatch([event],null),/OFFLINE_AUTH_REQUIRED/);assert.throws(()=>validateBatch([{...event,isAdmin:true}],tenant),/OFFLINE_INVALID_EVENT/);});

test("offline: rejects nested Mongo operator and prototype keys",()=>{
  assert.throws(()=>validateBatch([{...event,payload:{data:{"$set":{total:1}}}}],tenant),/OFFLINE_UNSAFE_KEY/);
  assert.throws(()=>validateBatch([{...event,payload:JSON.parse('{"__proto__":{"admin":true}}')}],tenant),/OFFLINE_UNSAFE_KEY/);
});
test("offline: rejects oversized events and excessive nesting",()=>{
  assert.throws(()=>validateBatch([{...event,payload:{memo:"X".repeat(70000)}}],tenant),/OFFLINE_PAYLOAD_TOO_LARGE/);
  let nested={v:"ok"};for(let i=0;i<14;i++) nested={child:nested};
  assert.throws(()=>validateBatch([{...event,payload:nested}],tenant),/OFFLINE_INVALID_PAYLOAD/);
});
