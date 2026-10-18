"use strict";
// Optional guarded legacy inventory applicator. Must run in same transaction as sale/cash/ledger.
// Never applies negative stock to legacy Inventario (min:0). Offline oversell requires
// a separate explicit exception/correction workflow; fail closed until reviewed.
const HEX=/^[a-f\d]{24}$/i,MAX=BigInt(Number.MAX_SAFE_INTEGER);
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function applyOfflineLegacyInventory({db,session,context,inventoryDeltas,objectId}){
 if(session?.inTransaction?.()!==true||typeof db?.collection!=="function")fail("OFFLINE_INVENTORY_TRANSACTION_REQUIRED");
 if(!HEX.test(context?.empresaId||"")||!HEX.test(context?.sedeId||"")||typeof objectId!=="function")
  fail("OFFLINE_INVENTORY_TENANT_REQUIRED");
 if(!Array.isArray(inventoryDeltas)||inventoryDeltas.length===0||inventoryDeltas.length>100)fail("OFFLINE_INVENTORY_INVALID_PLAN");
 const ids=new Set(),results=[];
 for(const delta of inventoryDeltas){
  if(!HEX.test(delta?.productoId||"")||ids.has(delta.productoId)||
   !/^-[1-9]\d*$/.test(delta?.deltaUnidades||""))fail("OFFLINE_INVENTORY_INVALID_PLAN");
  ids.add(delta.productoId);
  const units=-BigInt(delta.deltaUnidades);
  if(units>MAX)fail("OFFLINE_INVENTORY_INVALID_PLAN");
  const key={empresaId:objectId(context.empresaId),sedeId:objectId(context.sedeId),
   productoServicioId:objectId(delta.productoId),anulado:false};
  const inventory=db.collection("inventarios");
  const existing=await inventory.find(key,{session,projection:{_id:1,cantidad:1}}).limit(2).toArray();
  if(existing.length!==1)fail("OFFLINE_INVENTORY_MAPPING_AMBIGUOUS");
  const old=existing[0].cantidad;
  if(!Number.isSafeInteger(old)||old<0)fail("OFFLINE_INVENTORY_QUANTITY_UNSUPPORTED");
  if(BigInt(old)<units)fail("OFFLINE_INVENTORY_INSUFFICIENT");
  const updated=await inventory.updateOne({...key,_id:existing[0]._id,cantidad:old},
   {$inc:{cantidad:-Number(units)}},{session});
  if(updated.matchedCount!==1||updated.modifiedCount!==1)fail("OFFLINE_INVENTORY_CONCURRENT_CHANGE");
  // Read the persisted balance inside the SAME transaction, not an inferred
  // balance from the $inc request. Any discrepancy aborts the entire posting.
  const persisted=await inventory.findOne({...key,_id:existing[0]._id},
    {session,projection:{cantidad:1}});
  const expected=BigInt(old)-units;
  if(!persisted||!Number.isSafeInteger(persisted.cantidad)||persisted.cantidad<0||
     BigInt(persisted.cantidad)!==expected)fail("OFFLINE_INVENTORY_PERSISTENCE_CONFLICT");
  results.push(Object.freeze({productoId:delta.productoId,antes:String(old),despues:String(persisted.cantidad)}));
 }
 return Object.freeze(results);
}
module.exports={applyOfflineLegacyInventory};
