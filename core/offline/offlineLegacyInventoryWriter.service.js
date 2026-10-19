"use strict";
// Optional guarded legacy inventory applicator. Must run in same transaction as sale/cash/ledger.
// Never applies negative stock to legacy Inventario (min:0). Offline oversell requires
// a separate explicit exception/correction workflow; fail closed until reviewed.
const HEX=/^[a-f\d]{24}$/i,MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fail(code){const e=new Error(code);e.code=code;throw e;}
function owned(row,context,product){
 return row&&String(row.empresaId).toLowerCase()===context.empresaId.toLowerCase()&&
  String(row.sedeId).toLowerCase()===context.sedeId.toLowerCase()&&
  String(row.productoServicioId).toLowerCase()===product.toLowerCase()&&row.anulado===false;
}
async function applyOfflineLegacyInventory({db,session,context,inventoryDeltas,objectId}){
 if(session?.inTransaction?.()!==true||typeof db?.collection!=="function")fail("OFFLINE_INVENTORY_TRANSACTION_REQUIRED");
 if(typeof context?.empresaId!=="string"||typeof context?.sedeId!=="string"||
    !HEX.test(context.empresaId)||!HEX.test(context.sedeId)||typeof objectId!=="function")
  fail("OFFLINE_INVENTORY_TENANT_REQUIRED");
 if(!Array.isArray(inventoryDeltas)||inventoryDeltas.length===0||inventoryDeltas.length>100)fail("OFFLINE_INVENTORY_INVALID_PLAN");
 const ids=new Set();
 // Validate the ENTIRE plan before any inventory read/write. A forged second
 // product must not cause the first product to be debited in this transaction.
 for(const delta of inventoryDeltas){
  if(typeof delta?.productoId!=="string"||!HEX.test(delta.productoId)||
     ids.has(delta.productoId.toLowerCase())||
     typeof delta.deltaUnidades!=="string"||
     delta.deltaUnidades.length>17||
     !/^-[1-9]\d*$/.test(delta.deltaUnidades)||
     -BigInt(delta.deltaUnidades)>MAX)fail("OFFLINE_INVENTORY_INVALID_PLAN");
  ids.add(delta.productoId.toLowerCase());
 }
 // Resolve and verify the entire tenant/product identity set before any database access.
 const asId=value=>{
  let converted;
  try{converted=objectId(value);}catch(_error){fail("OFFLINE_INVENTORY_TENANT_REQUIRED");}
  if(converted===null||converted===undefined||
     String(converted).toLowerCase()!==value.toLowerCase())
    fail("OFFLINE_INVENTORY_TENANT_REQUIRED");
  return converted;
 };
 const scopedEmpresaId=asId(context.empresaId);
 const scopedSedeId=asId(context.sedeId);
 const scopedProducts=inventoryDeltas.map(delta=>asId(delta.productoId));
 const results=[];
 for(const [index,delta] of inventoryDeltas.entries()){
  const units=-BigInt(delta.deltaUnidades);
  const key={empresaId:scopedEmpresaId,sedeId:scopedSedeId,
   productoServicioId:scopedProducts[index],anulado:false};
  const inventory=db.collection("inventarios");
  const existing=await inventory.find(key,{session,projection:{_id:1,empresaId:1,sedeId:1,productoServicioId:1,anulado:1,cantidad:1}}).limit(2).toArray();
  if(!Array.isArray(existing)||existing.length!==1||
     existing[0]?._id===null||existing[0]?._id===undefined||
     String(existing[0]._id).trim().length===0||
     !owned(existing[0],context,delta.productoId))
   fail("OFFLINE_INVENTORY_MAPPING_AMBIGUOUS");
  const old=existing[0].cantidad;
  if(!Number.isSafeInteger(old)||old<0)fail("OFFLINE_INVENTORY_QUANTITY_UNSUPPORTED");
  if(BigInt(old)<units)fail("OFFLINE_INVENTORY_INSUFFICIENT");
  const updated=await inventory.updateOne({...key,_id:existing[0]._id,cantidad:old},
   {$inc:{cantidad:-Number(units)}},{session});
  if(updated.matchedCount!==1||updated.modifiedCount!==1)fail("OFFLINE_INVENTORY_CONCURRENT_CHANGE");
  // Read the persisted balance inside the SAME transaction, not an inferred
  // balance from the $inc request. Any discrepancy aborts the entire posting.
  const persisted=await inventory.findOne({...key,_id:existing[0]._id},
    {session,projection:{_id:1,empresaId:1,sedeId:1,productoServicioId:1,anulado:1,cantidad:1}});
  const expected=BigInt(old)-units;
  if(!owned(persisted,context,delta.productoId)||
     String(persisted._id)!==String(existing[0]._id)||
     !Number.isSafeInteger(persisted.cantidad)||persisted.cantidad<0||
     BigInt(persisted.cantidad)!==expected)fail("OFFLINE_INVENTORY_PERSISTENCE_CONFLICT");
  results.push(Object.freeze({productoId:delta.productoId,antes:String(old),despues:String(persisted.cantidad)}));
 }
 return Object.freeze(results);
}
module.exports={applyOfflineLegacyInventory};
