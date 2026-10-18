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
