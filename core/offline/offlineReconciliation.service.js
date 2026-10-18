"use strict";
// Read-only reconciliation. Receipt/staging never means money has been captured.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
function fail(code){const e=new Error(code);e.code=code;throw e;}
function validate(context,eventIds){
 if(!context||![context.empresaId,context.sedeId,context.actorId].every(x=>typeof x==="string"&&ID.test(x)))
  fail("OFFLINE_AUTH_REQUIRED");
 if(!Array.isArray(eventIds)||eventIds.length===0||eventIds.length>100||
    eventIds.some(id=>typeof id!=="string"||!ULID.test(id))||
    new Set(eventIds).size!==eventIds.length)fail("OFFLINE_INVALID_IDS");
}
async function readOfflineReconciliation({db,context,eventIds}){
 if(typeof db?.collection!=="function")fail("OFFLINE_DB_UNAVAILABLE");
 validate(context,eventIds);
 const scope={empresaId:context.empresaId,sedeId:context.sedeId,
  actorId:context.actorId,eventId:{$in:eventIds}};
 const specs=[
  ["gruk_offline_inbox",{eventId:1,status:1,inventoryApplied:1}],
  ["gruk_offline_ventas",{eventId:1,status:1,totalCop:1}],
  ["gruk_offline_caja_intenciones",{eventId:1,status:1,cobrado:1,montoCop:1}],
  ["gruk_ledger_movimientos",{eventId:1,tipo:1,montoCop:1,deletedAt:1}]
 ];
 const sets=await Promise.all(specs.map(async([name,projection])=>
  db.collection(name).find(scope,{projection:{_id:0,...projection}}).toArray()));
 const maps=sets.map(rows=>{
  const found=new Map();
  for(const row of rows){
   // Missing/duplicate event identities are ambiguous; never report completion.
   if(typeof row.eventId!=="string")continue;
   if(found.has(row.eventId))found.set(row.eventId,null);
   else found.set(row.eventId,row);
  }
  return found;
 });
 const cop=x=>typeof x==="string"&&/^(0|[1-9][0-9]*)$/.test(x);
 return eventIds.map(eventId=>{
  const [inbox,sale,cash,ledger]=maps.map(m=>m.get(eventId));
  if(!inbox)return {eventId,status:"NO_ENCONTRADO",applied:false,staged:false,financiallyReconciled:false};
  const staged=!!(sale&&cash&&ledger&&ledger.tipo==="VENTA_OFFLINE"&&
   ledger.deletedAt===null&&cop(sale.totalCop)&&cop(cash.montoCop)&&
   cop(ledger.montoCop)&&sale.totalCop===cash.montoCop&&cash.montoCop===ledger.montoCop);
  const financiallyReconciled=!!(staged&&sale.status==="CONTABILIZADA"&&
   cash.status==="CONCILIADO"&&cash.cobrado===true);
  const applied=inbox.status==="APLICADO"&&inbox.inventoryApplied===true&&financiallyReconciled;
  return {eventId,status:inbox.status,staged,financiallyReconciled,applied};
 });
}
module.exports={readOfflineReconciliation};
