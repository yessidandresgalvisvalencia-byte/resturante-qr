"use strict";
// Read-only preflight of original offline conflict. Results are a snapshot,
// never permission to post: staging must independently recheck under transaction.
const {readOfflineOrderCandidates}=require("./offlinePostingCandidates.service");
const {calculateOfflineStockDeltas}=require("./offlineInventoryDeltas.service");
const SHA=/^offline-stock-[a-f0-9]{64}$/,HEX=/^[a-f0-9]{24}$/i;
function fail(code){const error=new Error(code);error.code=code;throw error;}
async function preflightOfflineConflict({db,auth,conflictId,objectId}){
 if(!auth||!["DUEÑO","ADMIN_SEDE"].includes(auth.rol)||
    !HEX.test(auth.empresaId||"")||!HEX.test(auth.sedeId||"")||
    typeof auth.usuarioId!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(auth.usuarioId))
  fail("OFFLINE_CONFLICT_PERMISSION_DENIED");
 if(!SHA.test(conflictId||""))fail("OFFLINE_CONFLICT_INVALID_ID");
 if(typeof db?.collection!=="function"||typeof objectId!=="function")
  fail("OFFLINE_CONFLICT_DATABASE_UNAVAILABLE");
 const tenant={empresaId:auth.empresaId,sedeId:auth.sedeId};
 const source=await db.collection("gruk_offline_stock_conflicts").findOne({
  _id:conflictId,...tenant,status:"REQUIERE_REVISION",applied:false,cobrado:false
 },{projection:{_id:1,empresaId:1,sedeId:1,status:1,applied:1,cobrado:1,actorId:1,eventIds:1}});
 if(!source||source._id!==conflictId||
    source.empresaId!==tenant.empresaId||source.sedeId!==tenant.sedeId||
    source.status!=="REQUIERE_REVISION"||source.applied!==false||source.cobrado!==false||
    typeof source.actorId!=="string"||
    !/^[A-Za-z0-9_-]{1,80}$/.test(source.actorId)||
    !Array.isArray(source.eventIds)||source.eventIds.length===0||
    source.eventIds.length>100)
  fail("OFFLINE_CONFLICT_NOT_FOUND");
 const context={...tenant,actorId:source.actorId};
 let prepared;
 try{
  prepared=await readOfflineOrderCandidates({db,context,eventIds:source.eventIds});
 }catch(error){
  if(["OFFLINE_ORDERS_NOT_PENDING","OFFLINE_INVALID_IDS"].includes(error?.code))
   return Object.freeze({conflictId,ready:false,reason:"EVENTOS_NO_PENDIENTES",
    inventoryChanges:false,applied:false,cobrado:false,products:[]});
  throw error;
 }
 const deltas=calculateOfflineStockDeltas(prepared);
 const products=[];
 for(const delta of deltas){
  if(!HEX.test(delta.productoId)||!/^-\d+$/.test(delta.deltaUnidades))
   fail("OFFLINE_CONFLICT_INVALID_STOCK_PLAN");
  const rows=await db.collection("inventarios").find({
   empresaId:objectId(auth.empresaId),sedeId:objectId(auth.sedeId),
   productoServicioId:objectId(delta.productoId),anulado:false
  },{projection:{_id:1,empresaId:1,sedeId:1,productoServicioId:1,anulado:1,cantidad:1},limit:2}).toArray();
  const requested=-BigInt(delta.deltaUnidades);
  if(rows.length!==1||
     String(rows[0]?.empresaId).toLowerCase()!==auth.empresaId.toLowerCase()||
     String(rows[0]?.sedeId).toLowerCase()!==auth.sedeId.toLowerCase()||
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
