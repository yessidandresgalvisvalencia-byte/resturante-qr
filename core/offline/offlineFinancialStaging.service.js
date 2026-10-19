"use strict";
// Four staging journals share one Mongo transaction. No money captured or legacy
// balances altered; do not expose on public sync until real posting is certified.
const {stageOfflineSales}=require("./offlineSalesStaging.service");
const {stageOfflineStockMovements}=require("./offlineStockStaging.service");
const {stageOfflineCashIntents}=require("./offlineCashStaging.service");
const {postOfflineLedgerBatch}=require("./offlineLedgerBatchPoster.service");
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
