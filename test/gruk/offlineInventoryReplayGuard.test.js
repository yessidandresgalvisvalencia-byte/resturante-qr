"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {assertFreshOfflineStaging}=require("../../core/offline/offlineInventoryStagingTransaction.service");
const fresh=()=>({
  sales:{records:[{eventId:"eventA",inserted:true}]},
  cash:{records:[{eventId:"eventA",inserted:true}]},
  ledger:{entries:[{eventId:"eventA",inserted:true}]},
  stock:{records:[{productoId:"productA",inserted:true}]}
});
const deltas=[{productoId:"productA",deltaUnidades:"-1"}];
const plan={orders:[{eventId:"eventA"}]};
function rejects(staging){
 assert.throws(()=>assertFreshOfflineStaging(staging,deltas,plan),
  e=>e.code==="OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION");
}
test("offline stock: first posting may advance to legacy inventory",()=>{
 assert.equal(assertFreshOfflineStaging(fresh(),deltas,plan),true);
});
test("offline stock: retries with existing sale, cash, ledger or stock abort before debit",()=>{
 for(const group of ["sales","cash","ledger","stock"]){
  const staged=fresh();
  const name=group==="ledger"?"entries":"records";
  staged[group][name][0].inserted=false;
  rejects(staged);
 }
});
test("offline stock: incomplete journal or delta count never permits legacy decrement",()=>{
 const staged=fresh();
 staged.stock.records=[];
 rejects(staged);
 rejects({...fresh(),ledger:{entries:[]}});
 assert.throws(()=>assertFreshOfflineStaging(fresh(),[],plan),
  /OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION/);
});
test("offline stock: malformed journal status is not accepted as fresh",()=>{
 const staged=fresh();
 staged.cash.records[0].inserted="true";
 rejects(staged);
});

test("offline stock: mismatched journal event cannot authorize a debit",()=>{
 for(const group of ["sales","cash","ledger"]){
  const staged=fresh();
  const entries=group==="ledger"?"entries":"records";
  staged[group][entries][0].eventId="unrelated-event";
  rejects(staged);
 }
});
test("offline stock: wrong product id cannot authorize an inventory debit",()=>{
 const staged=fresh();
 staged.stock.records[0].productoId="unrelated-product";
 rejects(staged);
});
test("offline stock: fabricated duplicate receipts and missing plan are rejected",()=>{
 const staged=fresh();
 staged.ledger.entries.push({eventId:"eventA",inserted:true});
 rejects(staged);
 assert.throws(()=>assertFreshOfflineStaging(fresh(),deltas,{orders:[]}),
  /OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION/);
});
