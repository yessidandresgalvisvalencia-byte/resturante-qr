"use strict";
// Read-only preflight of original offline conflict. Results are a snapshot,
// never permission to post: staging must independently recheck under transaction.
const {readOfflineOrderCandidates}=require("./offlinePostingCandidates.service");
const {calculateOfflineStockDeltas}=require("./offlineInventoryDeltas.service");
const SHA=/^offline-stock-[a-f0-9]{64}$/,HEX=/^[a-f0-9]{24}$/i;
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
function fail(code){const error=new Error(code);error.code=code;throw error;}
async function preflightOfflineConflict({db,auth,conflictId,objectId}){
 const identity={};
 if(!auth||typeof auth!=="object"||Array.isArray(auth))
  fail("OFFLINE_CONFLICT_PERMISSION_DENIED");
 for(const field of ["rol","empresaId","sedeId","usuarioId"]){
  const descriptor=Object.getOwnPropertyDescriptor(auth,field);
  if(!descriptor||!("value" in descriptor))
   fail("OFFLINE_CONFLICT_PERMISSION_DENIED");
  identity[field]=descriptor.value;
 }
 if(!["DUEÑO","ADMIN_SEDE"].includes(identity.rol)||
    typeof identity.empresaId!=="string"||typeof identity.sedeId!=="string"||
    !HEX.test(identity.empresaId)||!HEX.test(identity.sedeId)||
    typeof identity.usuarioId!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(identity.usuarioId))
  fail("OFFLINE_CONFLICT_PERMISSION_DENIED");
 Object.freeze(identity);
 if(!SHA.test(conflictId||""))fail("OFFLINE_CONFLICT_INVALID_ID");
 if(typeof db?.collection!=="function"||typeof objectId!=="function")
  fail("OFFLINE_CONFLICT_DATABASE_UNAVAILABLE");
 // Verify all conversions before reading stock; an adapter must not redirect tenant/product scope.
 const asId=value=>{
  let converted;
  try{
   converted=objectId(value);
   if(converted===null||converted===undefined||
      String(converted).toLowerCase()!==value.toLowerCase())
     fail("OFFLINE_CONFLICT_INVALID_STOCK_PLAN");
  }catch(_error){fail("OFFLINE_CONFLICT_INVALID_STOCK_PLAN");}
  return converted;
 };
 const scopedEmpresa=asId(identity.empresaId),scopedSede=asId(identity.sedeId);
 const tenant={empresaId:identity.empresaId,sedeId:identity.sedeId};
 const source=await db.collection("gruk_offline_stock_conflicts").findOne({
  _id:conflictId,...tenant,status:"REQUIERE_REVISION",applied:false,cobrado:false
 },{projection:{_id:1,empresaId:1,sedeId:1,status:1,applied:1,cobrado:1,actorId:1,eventIds:1}});
 if(!source||typeof source!=="object"||Array.isArray(source))
  fail("OFFLINE_CONFLICT_NOT_FOUND");
 const captured={};
 for(const field of ["_id","empresaId","sedeId","status","applied","cobrado","actorId","eventIds"]){
  const d=Object.getOwnPropertyDescriptor(source,field);
  if(!d||!("value" in d))fail("OFFLINE_CONFLICT_NOT_FOUND");
  captured[field]=d.value;
 }
 if(captured._id!==conflictId||
    captured.empresaId!==tenant.empresaId||captured.sedeId!==tenant.sedeId||
    captured.status!=="REQUIERE_REVISION"||captured.applied!==false||
    captured.cobrado!==false||typeof captured.actorId!=="string"||
    !/^[A-Za-z0-9_-]{1,80}$/.test(captured.actorId)||
    !Array.isArray(captured.eventIds)||captured.eventIds.length===0||
    captured.eventIds.length>100)fail("OFFLINE_CONFLICT_NOT_FOUND");
 const capturedIds=[];
 for(let i=0;i<captured.eventIds.length;i++){
  const d=Object.getOwnPropertyDescriptor(captured.eventIds,String(i));
  if(!d||!("value" in d)||typeof d.value!=="string"||!ULID.test(d.value))
   fail("OFFLINE_CONFLICT_NOT_FOUND");
  capturedIds.push(d.value);
 }
 if(new Set(capturedIds).size!==capturedIds.length)fail("OFFLINE_CONFLICT_NOT_FOUND");
 const context=Object.freeze({...tenant,actorId:captured.actorId});
 let prepared;
 try{
  prepared=await readOfflineOrderCandidates({db,context,eventIds:capturedIds});
 }catch(error){
  if(["OFFLINE_ORDERS_NOT_PENDING","OFFLINE_INVALID_IDS"].includes(error?.code))
   return Object.freeze({conflictId,ready:false,reason:"EVENTOS_NO_PENDIENTES",
    inventoryChanges:false,applied:false,cobrado:false,products:[]});
  throw error;
 }
 const deltas=calculateOfflineStockDeltas(prepared);
 // Check every product conversion before the first inventory lookup.
 const convertedProducts=deltas.map(delta=>{
  if(typeof delta?.productoId!=="string"||!HEX.test(delta.productoId)||
     typeof delta.deltaUnidades!=="string"||!/^-\d+$/.test(delta.deltaUnidades))
    fail("OFFLINE_CONFLICT_INVALID_STOCK_PLAN");
  return asId(delta.productoId);
 });
 const products=[];
 for(const [index,delta] of deltas.entries()){
  if(!HEX.test(delta.productoId)||!/^-\d+$/.test(delta.deltaUnidades))
   fail("OFFLINE_CONFLICT_INVALID_STOCK_PLAN");
  const rows=await db.collection("inventarios").find({
   empresaId:scopedEmpresa,sedeId:scopedSede,
   productoServicioId:convertedProducts[index],anulado:false
  },{projection:{_id:1,empresaId:1,sedeId:1,productoServicioId:1,anulado:1,cantidad:1},limit:2}).toArray();
  const requested=-BigInt(delta.deltaUnidades);
  if(!Array.isArray(rows)||rows.length!==1||
     rows[0]?._id===null||rows[0]?._id===undefined||
     String(rows[0]._id).trim().length===0||
     String(rows[0]?.empresaId).toLowerCase()!==identity.empresaId.toLowerCase()||
     String(rows[0]?.sedeId).toLowerCase()!==identity.sedeId.toLowerCase()||
     String(rows[0]?.productoServicioId).toLowerCase()!==delta.productoId.toLowerCase()||
     rows[0]?.anulado!==false||
     !Number.isSafeInteger(rows[0].cantidad)||rows[0].cantidad<0){
   products.push({productoId:delta.productoId,requested:requested.toString(),
    available:null,shortage:null,ready:false,reason:"STOCK_SIN_MAPEO"});
   continue;
  }
  const available=BigInt(rows[0].cantidad);
  products.push({productoId:delta.productoId,requested:requested.toString(),
   available:available.toString(),
   shortage:(requested>available?requested-available:0n).toString(),
   ready:available>=requested,reason:available>=requested?null:"STOCK_INSUFICIENTE"});
 }
 const ready=products.length>0&&products.every(x=>x.ready===true);
 return Object.freeze({conflictId,ready,reason:ready?null:"REQUIERE_REVISION_STOCK",
  inventoryChanges:false,applied:false,cobrado:false,products});
}
module.exports={preflightOfflineConflict};
