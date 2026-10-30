"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {putPending}=require("../../public/js/gruk-offline-outbox");
const id="01ARZ3NDEKTSV4RRFFQ69G5FAV";
const base={eventId:id,empresaId:"empresa-A",sedeId:"sede_1",actorId:"actor-1",payload:{items:[]}};
test("Capa 2: nunca abre IndexedDB con identidad tenant no canónica",async()=>{
 for(const field of ["empresaId","sedeId","actorId"]){
  for(const value of [" empresa-A","empresa A","$ne","empresa.a","empresa/a","área","x".repeat(81),"a\nB", "\u0000"]){
   await assert.rejects(putPending({...base,[field]:value}),{message:"OUTBOX_TENANT_REQUIRED"});
  }
 }
});
test("Capa 2: ausencia de identidad también falla antes de abrir IndexedDB",async()=>{
 for(const field of ["empresaId","sedeId","actorId"]){
  const event={...base};delete event[field];
  await assert.rejects(putPending(event),{message:"OUTBOX_TENANT_REQUIRED"});
 }
});
