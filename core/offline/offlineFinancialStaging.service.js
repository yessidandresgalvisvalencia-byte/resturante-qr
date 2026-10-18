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
