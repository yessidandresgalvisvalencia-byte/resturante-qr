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
function rejects(staging){
 assert.throws(()=>assertFreshOfflineStaging(staging,deltas),
  e=>e.code==="OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION");
}
test("offline stock: first posting may advance to legacy inventory",()=>{
 assert.equal(assertFreshOfflineStaging(fresh(),deltas),true);
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
 assert.throws(()=>assertFreshOfflineStaging(fresh(),[]),
  /OFFLINE_INVENTORY_REPLAY_REQUIRES_RECONCILIATION/);
});
test("offline stock: malformed journal status is not accepted as fresh",()=>{
 const staged=fresh();
 staged.cash.records[0].inserted="true";
 rejects(staged);
});
