"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {assertExactResolvedOrders}=require("../../core/offline/offlineConflictRetry.service");
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
const err={code:"OFFLINE_CONFLICT_RESOLUTION_INCONSISTENT"};
test("Capa 2: la resolución requiere exactamente los pedidos autorizados",()=>{
 assert.equal(assertExactResolvedOrders(ids.map(eventId=>({eventId})),ids),true);
 assert.equal(assertExactResolvedOrders([...ids].reverse().map(eventId=>({eventId})),ids),true);
});
test("Capa 2: falla cerrado con pedidos dispersos, duplicados, ajenos o faltantes",()=>{
 const cases=[
  [, {eventId:ids[1]}],
  new Array(2),
  [{eventId:ids[0]}, ],
  [{eventId:ids[0]},{eventId:ids[0]}],
  [{eventId:ids[0]},{eventId:"01ARZ3NDEKTSV4RRFFQ69G5FA2"}],
  [{eventId:ids[0]},null],
  [{eventId:ids[0]},{eventId:undefined}],
  null,{},[]
 ];
 for(const orders of cases)assert.throws(()=>assertExactResolvedOrders(orders,ids),err);
});
test("Capa 2: también rechaza lista fuente dispersa o repetida",()=>{
 const sparse=[ids[0],ids[1]];delete sparse[0];
 assert.throws(()=>assertExactResolvedOrders(ids.map(eventId=>({eventId})),sparse),err);
 assert.throws(()=>assertExactResolvedOrders(ids.map(eventId=>({eventId})),[ids[0],ids[0]]),err);
});
