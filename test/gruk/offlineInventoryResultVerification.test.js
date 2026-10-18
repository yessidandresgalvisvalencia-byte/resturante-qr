"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {assertAppliedOfflineInventory:verify}=require("../../core/offline/offlineInventoryStagingTransaction.service");
const deltas=[
 {productoId:"507f191e810c19729de860aa",deltaUnidades:"-2"},
 {productoId:"507f191e810c19729de860bb",deltaUnidades:"-3"}
];
const valid=[
 {productoId:deltas[0].productoId,antes:"5",despues:"3"},
 {productoId:deltas[1].productoId,antes:"9",despues:"6"}
];
function conflict(result,expected=deltas){
 assert.throws(()=>verify(result,expected),e=>e.code==="OFFLINE_INVENTORY_RESULT_CONFLICT");
}
test("offline inventory: exact quantities for all products validate before commit",()=>{
 assert.equal(verify(valid,deltas),true);
 assert.equal(verify([...valid].reverse(),deltas),true);
});
test("offline inventory: missing, duplicate or alien product results fail closed",()=>{
 conflict([valid[0]]);
 conflict([valid[0],valid[0]]);
 conflict([valid[0],{...valid[1],productoId:"507f191e810c19729de860cc"}]);
});
test("offline inventory: debit mismatch or increased inventory causes rollback",()=>{
 conflict([valid[0],{...valid[1],despues:"5"}]);
 conflict([{...valid[0],despues:"7"},valid[1]]);
 conflict([{...valid[0],antes:"2",despues:"2"},valid[1]]);
});
test("offline inventory: invalid integers and negative balances are rejected",()=>{
 conflict([{...valid[0],antes:"5.0"},valid[1]]);
 conflict([{...valid[0],despues:"-1"},valid[1]]);
 conflict([{...valid[0],despues:3},valid[1]]);
 conflict(valid,[{...deltas[0],deltaUnidades:"-2.5"},deltas[1]]);
});
test("offline inventory: empty or duplicated delta plan cannot confirm posting",()=>{
 conflict([]);
 conflict(valid,[]);
 conflict(valid,[deltas[0],deltas[0]]);
});
