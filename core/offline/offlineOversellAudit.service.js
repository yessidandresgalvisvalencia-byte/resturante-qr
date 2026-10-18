"use strict";
// Audit-only record AFTER an insufficient-stock transaction rolled back.
// Does not mutate inventory, sales, ledger, inbox or cash.
const {createHash}=require("node:crypto");
const {readOfflineOrderCandidates}=require("./offlinePostingCandidates.service");
const {calculateOfflineStockDeltas}=require("./offlineInventoryDeltas.service");
const HEX=/^[0-9a-f]{24}$/i,MAX=BigInt(Number.MAX_SAFE_INTEGER);
function conflict(code){const e=new Error(code);e.code=code;throw e;}
async function recordOfflineOversellConflict({db,context,eventIds,objectId}){
 if(typeof db?.collection!=="function"||typeof objectId!=="function"||
  !HEX.test(context?.empresaId||"")||!HEX.test(context?.sedeId||""))
  conflict("OFFLINE_STOCK_AUDIT_UNAVAILABLE");
 // Re-validate original inbox events in their authenticated scope. Never trust
 // amounts or products submitted alongside a request to create an audit entry.
 const prepared=await readOfflineOrderCandidates({db,context,eventIds});
 const deltas=calculateOfflineStockDeltas(prepared);
 const issues=[];
 for(const delta of deltas){
  if(!HEX.test(delta.productoId))conflict("OFFLINE_STOCK_AUDIT_INVALID_PRODUCT");
  const rows=await db.collection("inventarios").find({
   empresaId:objectId(context.empresaId),sedeId:objectId(context.sedeId),
   productoServicioId:objectId(delta.productoId),anulado:false
  },{projection:{_id:1,cantidad:1},limit:2}).toArray();
  if(rows.length!==1||!Number.isSafeInteger(rows[0].cantidad)||rows[0].cantidad<0)
   conflict("OFFLINE_STOCK_AUDIT_MAPPING_UNAVAILABLE");
  const requested=-BigInt(delta.deltaUnidades),available=BigInt(rows[0].cantidad);
  if(requested>MAX)conflict("OFFLINE_STOCK_AUDIT_INVALID_QUANTITY");
  if(requested>available)issues.push(Object.freeze({
   productoId:delta.productoId,disponible:available.toString(),
   solicitado:requested.toString(),faltante:(requested-available).toString()
  }));
 }
 // Never create a false conflict if the stock recovered between failed staging
 // and this read; the caller should retry with a NEW explicit confirmation.
 if(issues.length===0)conflict("OFFLINE_STOCK_CONFLICT_NO_LONGER_PRESENT");
 const sorted=[...eventIds].sort();
 const fingerprint=createHash("sha256").update(JSON.stringify([
  context.empresaId,context.sedeId,context.actorId,sorted
 ])).digest("hex");
 const conflictId="offline-stock-"+fingerprint;
 const collection=db.collection("gruk_offline_stock_conflicts");
 const key={_id:conflictId,empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId};
 const result=await collection.updateOne(key,{$setOnInsert:{
  ...key,eventIds:sorted,issues,status:"REQUIERE_REVISION",createdAt:new Date(),
  source:"OFFLINE_INVENTORY_INSUFFICIENT",applied:false,cobrado:false
 }},{upsert:true});
 if(result?.upsertedCount!==1&&result?.matchedCount!==1)
  conflict("OFFLINE_STOCK_AUDIT_PERSISTENCE_FAILED");
 // On a retry, expose the original durable record rather than implying a
 // second correction or replacing the first observation.
 const persisted=await collection.findOne(key,{projection:{
  _id:1,status:1,eventIds:1,issues:1,applied:1,cobrado:1
 }});
 if(!persisted||persisted.status!=="REQUIERE_REVISION"||
  persisted.applied!==false||persisted.cobrado!==false||
  !Array.isArray(persisted.eventIds)||persisted.eventIds.join(",")!==sorted.join(",")||
  !Array.isArray(persisted.issues)||persisted.issues.length===0)
  conflict("OFFLINE_STOCK_AUDIT_PERSISTENCE_FAILED");
 return Object.freeze({
  status:"REQUIERE_REVISION_STOCK",conflictId,applied:false,cobrado:false,
  issues:persisted.issues
 });
}
module.exports={recordOfflineOversellConflict};
