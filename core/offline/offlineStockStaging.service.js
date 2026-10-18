"use strict";
// Append-only offline stock movement staging. Does not update legacy inventory.
// A reconciler must apply these deltas in the same transaction as final sales/cash.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const PRODUCT=/^[a-fA-F0-9]{24}$/;
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function stageOfflineStockMovements({db,session,context,plan,inventoryDeltas}){
 if(!db?.collection||session?.inTransaction?.()!==true)fail("OFFLINE_STOCK_TRANSACTION_REQUIRED");
 if(!context||![context.empresaId,context.sedeId,context.actorId].every(x=>typeof x==="string"&&ID.test(x)))fail("OFFLINE_STOCK_AUTH_REQUIRED");
 if(!Array.isArray(plan?.orders)||plan.orders.length===0||!Array.isArray(inventoryDeltas))fail("OFFLINE_STOCK_INVALID_PLAN");
 // Recalculate the inventory plan independently to prevent caller-provided deltas.
 const {calculateOfflineStockDeltas}=require("./offlineInventoryDeltas.service");
 const expected=calculateOfflineStockDeltas(plan);
 const supplied=new Map();
 for(const d of inventoryDeltas){
   if(!d||!PRODUCT.test(d.productoId||"")||typeof d.deltaUnidades!=="string"||
     !/^-[1-9][0-9]*$/.test(d.deltaUnidades)||supplied.has(d.productoId))fail("OFFLINE_STOCK_INVALID_PLAN");
   supplied.set(d.productoId,d.deltaUnidades);
 }
 if(expected.length!==supplied.size||expected.some(d=>supplied.get(d.productoId)!==d.deltaUnidades))
   fail("OFFLINE_STOCK_TOTAL_CONFLICT");
 const stock=db.collection("gruk_offline_stock_movimientos");
 const indexes=await stock.indexes();
 if(!Array.isArray(indexes)||!indexes.some(i=>i.name==="uniq_offline_stock_tenant_batch_product"&&i.unique===true&&
 ["empresaId","sedeId","batchId","productoId"].every(k=>i.key?.[k]===1)&&Object.keys(i.key||{}).length===4))
  fail("OFFLINE_STOCK_UNIQUE_INDEX_REQUIRED");
 // Batch ID is deterministic: sorted event IDs, hashed so retries resolve to same key.
 const {createHash}=require("node:crypto");
 const batchId=createHash("sha256").update(plan.orders.map(o=>o.eventId).sort().join("|")).digest("hex");
 const records=[];
 for(const d of expected){
  const key={empresaId:context.empresaId,sedeId:context.sedeId,batchId,productoId:d.productoId};
  const payload={...key,actorId:context.actorId,deltaUnidades:d.deltaUnidades,status:"PENDIENTE_APLICACION",createdAt:new Date()};
  let result;
  try{result=await stock.updateOne(key,{$setOnInsert:payload},{upsert:true,session});}
  catch(err){if(err?.code===11000)fail("OFFLINE_STOCK_CONCURRENT_RETRY_REQUIRED");throw err;}
  if(result.upsertedCount!==1){
   const old=await stock.findOne(key,{session,projection:{actorId:1,deltaUnidades:1,status:1}});
   if(!old||old.actorId!==payload.actorId||old.deltaUnidades!==payload.deltaUnidades||
      old.status!=="PENDIENTE_APLICACION")fail("OFFLINE_STOCK_REPLAY_CONFLICT");
  }
  records.push(Object.freeze({productoId:d.productoId,inserted:result.upsertedCount===1}));
 }
 return Object.freeze({batchId,records:Object.freeze(records)});
}
module.exports={stageOfflineStockMovements};
