"use strict";
// Read-only readiness check. Never creates indexes in a request or touches money.
const SPECS=Object.freeze([
 ["gruk_offline_ventas","uniq_offline_sale_tenant_event",["empresaId","sedeId","eventId"]],
 ["gruk_offline_stock_movimientos","uniq_offline_stock_tenant_batch_product",["empresaId","sedeId","batchId","productoId"]],
 ["gruk_offline_caja_intenciones","uniq_offline_cash_tenant_event",["empresaId","sedeId","eventId"]],
 ["gruk_ledger_movimientos","uniq_offline_ledger_event_type_tenant",["empresaId","sedeId","eventId","tipo"]]
]);
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function assertOfflineStagingIndexes(db){
 if(typeof db?.collection!=="function")fail("OFFLINE_INDEX_DB_REQUIRED");
 for(const [collection,name,keys] of SPECS){
  const list=await db.collection(collection).indexes();
  const valid=Array.isArray(list)&&list.some(i=>i.name===name&&i.unique===true&&
   Object.keys(i.key||{}).length===keys.length&&
   keys.every((key,idx)=>Object.keys(i.key)[idx]===key&&i.key[key]===1));
  if(!valid)fail("OFFLINE_INDEX_NOT_READY");
 }
 return Object.freeze({ready:true,collections:SPECS.length});
}
module.exports={assertOfflineStagingIndexes};
