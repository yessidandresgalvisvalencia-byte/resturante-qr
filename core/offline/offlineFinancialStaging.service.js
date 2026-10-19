"use strict";
// Four staging journals share one Mongo transaction. No money captured or legacy
// balances altered; do not expose on public sync until real posting is certified.
const {stageOfflineSales}=require("./offlineSalesStaging.service");
const {stageOfflineStockMovements}=require("./offlineStockStaging.service");
const {stageOfflineCashIntents}=require("./offlineCashStaging.service");
const {postOfflineLedgerBatch}=require("./offlineLedgerBatchPoster.service");
const {calculateOfflineStockDeltas}=require("./offlineInventoryDeltas.service");
function fail(){const e=new Error("OFFLINE_STAGING_TOTAL_CONFLICT");e.code=e.message;throw e;}
async function stageOfflineFinancialBatch({db,session,context,plan,inventoryDeltas,ledgerMovements}){
 if(session?.inTransaction?.()!==true)fail();
 // Journal totals alone cannot prove that the ledger belongs to the same orders.
 // Reject a mismatched event or amount before ANY of the four writes.
 if(!Array.isArray(plan?.orders)||!plan.orders.length||plan.orders.length>100||
    !Array.isArray(ledgerMovements)||ledgerMovements.length!==plan.orders.length)fail();
 const expected=new Map();
 for(const order of plan.orders){
  if(typeof order?.eventId!=="string"||expected.has(order.eventId)||
     typeof order.totalCop!=="string")fail();
  expected.set(order.eventId,order.totalCop);
 }
 const matched=new Set();
 for(const movement of ledgerMovements){
  if(typeof movement?.eventId!=="string"||matched.has(movement.eventId)||
     movement.tipo!=="VENTA_OFFLINE"||
     !expected.has(movement.eventId)||movement.montoCop!==expected.get(movement.eventId))fail();
  matched.add(movement.eventId);
 }
 // Stock evidence must match the verified order quantities before any journal
 // writer is called; do not rely on a later writer to detect foreign products.
 const expectedStock=calculateOfflineStockDeltas(plan);
 if(!Array.isArray(inventoryDeltas)||inventoryDeltas.length!==expectedStock.length)fail();
 const deltas=new Map();
 for(const d of inventoryDeltas){
  if(typeof d?.productoId!=="string"||deltas.has(d.productoId)||
     typeof d.deltaUnidades!=="string")fail();
  deltas.set(d.productoId,d.deltaUnidades);
 }
 if(expectedStock.some(d=>deltas.get(d.productoId)!==d.deltaUnidades))fail();
 const sales=await stageOfflineSales({db,session,context,plan});
 const stock=await stageOfflineStockMovements({db,session,context,plan,inventoryDeltas});
 const cash=await stageOfflineCashIntents({db,session,context,plan});
 const ledger=await postOfflineLedgerBatch({db,session,context,ledgerMovements});
 if(sales.totalCop!==plan.totalCop||cash.totalCop!==sales.totalCop||
   ledger.totalCop!==sales.totalCop||
   sales.records.length!==cash.records.length||sales.records.length!==ledger.entries.length)fail();
 return Object.freeze({status:"PENDIENTE_CONTABILIZACION",sales,stock,cash,ledger});
}
module.exports={stageOfflineFinancialBatch};
