"use strict";
// Stages sale, stock and ledger in the SAME caller-provided Mongo transaction.
// Does not settle cash, update legacy inventory, or mark inbox APPLIED.
// Must not be attached to /api/sync/batch until final posting is implemented.
const {stageOfflineSales}=require("./offlineSalesStaging.service");
const {stageOfflineStockMovements}=require("./offlineStockStaging.service");
const {postOfflineLedgerBatch}=require("./offlineLedgerBatchPoster.service");
function fail(){const e=new Error("OFFLINE_STAGING_TOTAL_CONFLICT");e.code=e.message;throw e;}
async function stageOfflineFinancialBatch({db,session,context,plan,inventoryDeltas,ledgerMovements}){
 if(session?.inTransaction?.()!==true)fail();
 const sales=await stageOfflineSales({db,session,context,plan});
 const stock=await stageOfflineStockMovements({db,session,context,plan,inventoryDeltas});
 const ledger=await postOfflineLedgerBatch({db,session,context,ledgerMovements});
 if(sales.totalCop!==plan.totalCop||ledger.totalCop!==sales.totalCop||
   sales.records.length!==ledger.entries.length)fail();
 return Object.freeze({status:"PENDIENTE_CONTABILIZACION",sales,stock,ledger});
}
module.exports={stageOfflineFinancialBatch};
