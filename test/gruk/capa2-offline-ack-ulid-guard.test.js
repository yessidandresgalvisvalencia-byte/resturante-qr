"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {markReceived,markReconciled}=require("../../public/js/gruk-offline-outbox");
const ctx={empresaId:"empresa-A",sedeId:"sede-A",actorId:"actor-A"};
const reconciliation={status:"PENDIENTE",applied:false,staged:false,financiallyReconciled:false};
test("Capa 2: ULID inválido no accede a IndexedDB para ACK ni conciliación",async()=>{
 for(const id of ["",null,undefined,4,{},"$ne","01ARZ3NDEKTSV4RRFFQ69G5FAO","a".repeat(26)]){
   await assert.rejects(markReceived(id,ctx),/OUTBOX_EVENT_ID/);
   await assert.rejects(markReconciled(id,ctx,{...reconciliation,eventId:id}),/OUTBOX_EVENT_ID/);
 }
});
test("Capa 2: identidad invalida tiene prioridad sobre ID para cerrar alcance",async()=>{
 const bad={...ctx,empresaId:"$ne"};
 await assert.rejects(markReceived("bad",bad),/OUTBOX_TENANT_REQUIRED/);
 await assert.rejects(markReconciled("bad",bad,{}),/OUTBOX_TENANT_REQUIRED/);
});
