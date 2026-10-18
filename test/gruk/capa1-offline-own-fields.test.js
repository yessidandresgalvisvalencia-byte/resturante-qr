"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateBatch}=require("../../core/offline/offlineBatch.contract");
const ctx={empresaId:"empresaA",sedeId:"sedeA",actorId:"actorA"};
const base={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",...ctx,deviceId:"tabletA",tipo:"PEDIDO_REGISTRADO",occurredAt:"2026-10-18T12:00:00.000Z",schemaVersion:1,payload:{localOrderId:"pedidoA"}};
test("offline: plain own-field event passes tenant validation",()=>{
 const result=validateBatch([base],ctx);
 assert.equal(result[0].eventId,base.eventId);
});
test("offline: inherited required fields cannot pass validation",()=>{
 const inherited=Object.assign(Object.create({empresaId:ctx.empresaId}),base);
 delete inherited.empresaId;
 assert.throws(()=>validateBatch([inherited],ctx),/OFFLINE_INVALID_EVENT/);
});
test("offline: inherited object prototype and missing own field rejected",()=>{
 const custom=Object.assign(Object.create({marker:"forged"}),base);
 assert.throws(()=>validateBatch([custom],ctx),/OFFLINE_INVALID_EVENT/);
 const missing={...base};
 delete missing.deviceId;
 assert.throws(()=>validateBatch([missing],ctx),/OFFLINE_INVALID_EVENT/);
});
test("offline: unexpected event field rejected",()=>{
 assert.throws(()=>validateBatch([{...base,admin:true}],ctx),/OFFLINE_INVALID_EVENT/);
});
