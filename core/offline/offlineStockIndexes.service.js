"use strict";
async function ensureOfflineStockIndexes(db){
 if(typeof db?.collection!=="function")throw new TypeError("OFFLINE_DATABASE_REQUIRED");
 await db.collection("gruk_offline_stock_movimientos").createIndex(
  {empresaId:1,sedeId:1,batchId:1,productoId:1},
  {unique:true,name:"uniq_offline_stock_tenant_batch_product"});
 return true;
}
module.exports={ensureOfflineStockIndexes};
