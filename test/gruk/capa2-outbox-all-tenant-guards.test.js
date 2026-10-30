"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const outbox=require("../../public/js/gruk-offline-outbox");
const id="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const valid={empresaId:"empresa-A",sedeId:"sede-1",actorId:"operador-1"};
test("Capa 2: todo acceso al outbox rechaza identidad malformada antes de IndexedDB",async()=>{
 for(const key of ["empresaId","sedeId","actorId"]){
  for(const value of ["$ne","empresa.01"," empresa-01","área","a/b","x".repeat(81),"\u0000"]){
   const ctx={...valid,[key]:value};
   const operations=[
    ()=>outbox.listPending(10,ctx),
    ()=>outbox.listReceived(10,ctx),
    ()=>outbox.listLocal(10,ctx),
    ()=>outbox.listStockReservations(ctx),
    ()=>outbox.markReceived(id,ctx),
    ()=>outbox.markReconciled(id,ctx,{eventId:id,status:"PENDIENTE",applied:false,staged:false,financiallyReconciled:false})
   ];
   for(const run of operations)await assert.rejects(run(),/OUTBOX_TENANT_REQUIRED/,key+":"+JSON.stringify(value));
  }
 }
});
test("Capa 2: no se permite alcance de identidad incompleto",async()=>{
 for(const key of ["empresaId","sedeId","actorId"]){
  const ctx={...valid};delete ctx[key];
  await assert.rejects(outbox.listPending(1,ctx),/OUTBOX_TENANT_REQUIRED/);
  await assert.rejects(outbox.listStockReservations(ctx),/OUTBOX_TENANT_REQUIRED/);
 }
});
