"use strict";
// Audit-only record AFTER an insufficient-stock transaction rolled back.
// Does not mutate inventory, sales, ledger, inbox or cash.
const {createHash}=require("node:crypto");
const {readOfflineOrderCandidates}=require("./offlinePostingCandidates.service");
const {calculateOfflineStockDeltas}=require("./offlineInventoryDeltas.service");
const HEX=/^[0-9a-f]{24}$/i,MAX=BigInt(Number.MAX_SAFE_INTEGER);
function conflict(code){const e=new Error(code);e.code=code;throw e;}
function safeInventoryId(value){
 return (typeof value==="string"&&value.trim().length>0)||
  (value&&value._bsontype==="ObjectId"&&
   typeof value.toHexString==="function"&&HEX.test(value.toHexString()));
}
function validIssues(issues,deltas){
 if(!Array.isArray(issues)||issues.length===0||issues.length>deltas.length||
    !Array.from({length:issues.length},(_,i)=>Object.hasOwn(issues,i)).every(Boolean))return false;
 const allowed=new Map(deltas.map(d=>[d.productoId.toLowerCase(),-BigInt(d.deltaUnidades)])),seen=new Set();
 for(const issue of issues){
  if(!issue||typeof issue.productoId!=="string"||!HEX.test(issue.productoId)||
     !allowed.has(issue.productoId.toLowerCase())||seen.has(issue.productoId.toLowerCase()))return false;
  seen.add(issue.productoId.toLowerCase());
  const amounts=[issue.disponible,issue.solicitado,issue.faltante];
  if(amounts.some(v=>typeof v!=="string"||v.length>16||
    !/^(0|[1-9][0-9]*)$/.test(v)||BigInt(v)>MAX))return false;
  const [available,requested,shortage]=amounts.map(BigInt);
  if(requested!==allowed.get(issue.productoId.toLowerCase())||
     requested<=available||shortage!==requested-available)return false;
 }
 return true;
}
async function recordOfflineOversellConflict({db,context,eventIds,objectId}){
 // Capture authenticated scope and event IDs once. Do not reuse mutable caller
 // objects after asynchronous Mongo reads, especially when writing the audit.
 const scoped={};
 if(!context||typeof context!=="object"||Array.isArray(context))
  conflict("OFFLINE_STOCK_AUDIT_UNAVAILABLE");
 for(const field of ["empresaId","sedeId","actorId"]){
  const descriptor=Object.getOwnPropertyDescriptor(context,field);
  if(!descriptor||!("value" in descriptor)||typeof descriptor.value!=="string"||
    !(field==="actorId"?/^[A-Za-z0-9_-]{1,80}$/:HEX).test(descriptor.value))
   conflict("OFFLINE_STOCK_AUDIT_UNAVAILABLE");
  scoped[field]=descriptor.value;
 }
 if(!Array.isArray(eventIds)||eventIds.length===0||eventIds.length>100)
  conflict("OFFLINE_INVALID_IDS");
 const ids=[];
 for(let i=0;i<eventIds.length;i++){
  const descriptor=Object.getOwnPropertyDescriptor(eventIds,String(i));
  if(!descriptor||!("value" in descriptor)||typeof descriptor.value!=="string"||
    !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(descriptor.value))
   conflict("OFFLINE_INVALID_IDS");
  ids.push(descriptor.value);
 }
 if(new Set(ids).size!==ids.length)conflict("OFFLINE_INVALID_IDS");
 const identity=Object.freeze(scoped);
 const capturedIds=Object.freeze(ids);
 if(!db||typeof db.collection!=="function"||typeof objectId!=="function")
  conflict("OFFLINE_STOCK_AUDIT_UNAVAILABLE");
 // Read pending orders only within the captured authenticated tenant scope.
 const prepared=await readOfflineOrderCandidates({db,context:identity,eventIds:capturedIds});
 const deltas=calculateOfflineStockDeltas(prepared);
 // Reject a faulty ObjectId adapter before accessing inventory of another tenant.
 const asId=value=>{
  let converted;
  try{converted=objectId(value);}catch(_error){conflict("OFFLINE_STOCK_AUDIT_IDENTITY_INVALID");}
  if(!(typeof converted==="string"||
      (converted&&converted._bsontype==="ObjectId"&&typeof converted.toHexString==="function"))||
    String(converted).toLowerCase()!==value.toLowerCase())
    conflict("OFFLINE_STOCK_AUDIT_IDENTITY_INVALID");
  return converted;
 };
 const scopedEmpresaId=asId(identity.empresaId),scopedSedeId=asId(identity.sedeId);
 const products=deltas.map(delta=>{
  if(typeof delta?.productoId!=="string"||!HEX.test(delta.productoId))
    conflict("OFFLINE_STOCK_AUDIT_INVALID_PRODUCT");
  return asId(delta.productoId);
 });
 const issues=[];
 for(const [index,delta] of deltas.entries()){
  const rows=await db.collection("inventarios").find({
   empresaId:scopedEmpresaId,sedeId:scopedSedeId,
   productoServicioId:products[index],anulado:false
  },{projection:{_id:1,empresaId:1,sedeId:1,productoServicioId:1,anulado:1,cantidad:1},limit:2}).toArray();
  if(!Array.isArray(rows)||rows.length!==1||!Object.hasOwn(rows,0)||
   !rows[0]||typeof rows[0]!=="object"||
   !safeInventoryId(rows[0]._id)||
   String(rows[0]?.empresaId).toLowerCase()!==identity.empresaId.toLowerCase()||
   String(rows[0]?.sedeId).toLowerCase()!==identity.sedeId.toLowerCase()||
   String(rows[0]?.productoServicioId).toLowerCase()!==delta.productoId.toLowerCase()||
   rows[0]?.anulado!==false||
   !Number.isSafeInteger(rows[0].cantidad)||rows[0].cantidad<0)
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
 const sorted=[...capturedIds].sort();
 const fingerprint=createHash("sha256").update(JSON.stringify([
  identity.empresaId,identity.sedeId,identity.actorId,sorted
 ])).digest("hex");
 const conflictId="offline-stock-"+fingerprint;
 const collection=db.collection("gruk_offline_stock_conflicts");
 const key={_id:conflictId,empresaId:identity.empresaId,sedeId:identity.sedeId,actorId:identity.actorId};
 const result=await collection.updateOne(key,{$setOnInsert:{
  ...key,eventIds:sorted,issues,status:"REQUIERE_REVISION",createdAt:new Date(),
  source:"OFFLINE_INVENTORY_INSUFFICIENT",applied:false,cobrado:false
 }},{upsert:true});
 if(result?.acknowledged!==true||
    !Number.isInteger(result.upsertedCount)||
    !Number.isInteger(result.matchedCount)||
    !((result.upsertedCount===1&&result.matchedCount===0)||
      (result.upsertedCount===0&&result.matchedCount===1)))
  conflict("OFFLINE_STOCK_AUDIT_PERSISTENCE_FAILED");
 // On a retry, expose the original durable record rather than implying a
 // second correction or replacing the first observation.
 const persisted=await collection.findOne(key,{projection:{
  _id:1,empresaId:1,sedeId:1,actorId:1,status:1,eventIds:1,issues:1,applied:1,cobrado:1
 }});
 if(!persisted||persisted._id!==conflictId||
  persisted.empresaId!==identity.empresaId||persisted.sedeId!==identity.sedeId||
  persisted.actorId!==identity.actorId||persisted.status!=="REQUIERE_REVISION"||
  persisted.applied!==false||persisted.cobrado!==false||
  !Array.isArray(persisted.eventIds)||persisted.eventIds.length!==sorted.length||
  !Array.from({length:persisted.eventIds.length},(_,i)=>Object.hasOwn(persisted.eventIds,i)).every(Boolean)||
  persisted.eventIds.join(",")!==sorted.join(",")||
  !validIssues(persisted.issues,deltas))
  conflict("OFFLINE_STOCK_AUDIT_PERSISTENCE_FAILED");
 return Object.freeze({
  status:"REQUIERE_REVISION_STOCK",conflictId,applied:false,cobrado:false,
  issues:persisted.issues
 });
}
module.exports={recordOfflineOversellConflict};
