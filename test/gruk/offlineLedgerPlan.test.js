"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {buildOfflineLedgerPlan:build}=require("../../core/offline/offlineLedgerPlan.service");
const a="01ARZ3NDEKTSV4RRFFQ69G5FA0",b="01ARZ3NDEKTSV4RRFFQ69G5FA1";
test("crea un movimiento por pedido y concilia su suma COP",()=>{
 const result=build({orders:[{eventId:a,totalCop:"1000"},{eventId:b,totalCop:"2000"}],totalCop:"3000"});
 assert.deepEqual(result,[{eventId:a,tipo:"VENTA_OFFLINE",montoCop:"1000"},{eventId:b,tipo:"VENTA_OFFLINE",montoCop:"2000"}]);
});
test("rechaza totales no conciliados o eventos duplicados",()=>{
 for(const plan of [
  {orders:[{eventId:a,totalCop:"1000"}],totalCop:"999"},
  {orders:[{eventId:a,totalCop:"1000"},{eventId:a,totalCop:"1000"}],totalCop:"2000"},
  {orders:[{eventId:a,totalCop:"1.5"}],totalCop:"1"}
 ])assert.throws(()=>build(plan),e=>e.code==="OFFLINE_LEDGER_PLAN_CONFLICT");
});
test("rechaza acumulados superiores al entero seguro",()=>{
 assert.throws(()=>build({orders:[{eventId:a,totalCop:"9007199254740991"},{eventId:b,totalCop:"1"}],totalCop:"9007199254740992"}),
 e=>e.code==="OFFLINE_LEDGER_PLAN_CONFLICT");
});

test("Capa 2: ningún pedido incompleto puede crear asientos ni ocultar dinero",()=>{
 const first={eventId:a,totalCop:"1000"},second={eventId:b,totalCop:"2000"};
 for(const orders of [
  new Array(1),[first,,second],[,first],[first,,],
  Array.from({length:101},()=>first)
 ]){
  assert.throws(()=>build({orders,totalCop:"3000"}),
   {code:"OFFLINE_LEDGER_PLAN_CONFLICT"});
 }
 assert.deepEqual(build({orders:[first,second],totalCop:"3000"}),[
  {eventId:a,tipo:"VENTA_OFFLINE",montoCop:"1000"},
  {eventId:b,tipo:"VENTA_OFFLINE",montoCop:"2000"}
 ]);
});
test("Capa 2: rechaza cantidades COP excesivas antes de BigInt",()=>{
 for(const huge of ["9".repeat(10000),"0".repeat(10000),"9007199254740992"]){
  assert.throws(()=>build({orders:[{eventId:a,totalCop:huge}],totalCop:huge}),
   {code:"OFFLINE_LEDGER_PLAN_CONFLICT"});
  assert.throws(()=>build({orders:[{eventId:a,totalCop:"1"}],totalCop:huge}),
   {code:"OFFLINE_LEDGER_PLAN_CONFLICT"});
 }
});
