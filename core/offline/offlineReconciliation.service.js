"use strict";
// Read-only reconciliation. Receipt/staging never means money has been captured.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const {STATES}=require("./offlineState.contract");
const VALID_STATES=new Set(Object.values(STATES));
function fail(code){const e=new Error(code);e.code=code;throw e;}
function validate(context,eventIds){
 if(!context||typeof context!=="object"||Array.isArray(context))
  fail("OFFLINE_AUTH_REQUIRED");
 const scope={};
 for(const field of ["empresaId","sedeId","actorId"]){
  const d=Object.getOwnPropertyDescriptor(context,field);
  if(!d||!("value" in d)||typeof d.value!=="string"||!ID.test(d.value))
   fail("OFFLINE_AUTH_REQUIRED");
  scope[field]=d.value;
 }
 if(!Array.isArray(eventIds)||eventIds.length===0||eventIds.length>100)
  fail("OFFLINE_INVALID_IDS");
 const ids=[];
 for(let i=0;i<eventIds.length;i++){
  const d=Object.getOwnPropertyDescriptor(eventIds,String(i));
  if(!d||!("value" in d)||typeof d.value!=="string"||!ULID.test(d.value))
   fail("OFFLINE_INVALID_IDS");
  ids.push(d.value);
 }
 if(new Set(ids).size!==ids.length)fail("OFFLINE_INVALID_IDS");
 return {identity:Object.freeze(scope),ids:Object.freeze(ids)};
}
async function readOfflineReconciliation({db,context,eventIds,session=null}){
 // Authorization and ULIDs must be immutable before touching any adapter.
 const {identity,ids}=validate(context,eventIds);
 if(!db||typeof db.collection!=="function")fail("OFFLINE_DB_UNAVAILABLE");
 const scope={empresaId:identity.empresaId,sedeId:identity.sedeId,
  eventId:{$in:ids}};
 const specs=[
  ["gruk_offline_inbox",{eventId:1,status:1,inventoryApplied:1}],
  ["gruk_offline_ventas",{eventId:1,status:1,totalCop:1}],
  ["gruk_offline_caja_intenciones",{eventId:1,status:1,cobrado:1,montoCop:1}],
  ["gruk_ledger_movimientos",{eventId:1,tipo:1,montoCop:1,deletedAt:1}]
 ];
 const load=async([name,projection])=>
  db.collection(name).find(name==="gruk_offline_inbox"?{...scope,actorId:identity.actorId}:scope,
   {projection:{_id:0,empresaId:1,sedeId:1,actorId:1,...projection},limit:101,...(session?{session}:{})}).toArray();
 // MongoDB does not support concurrent operations on a single transaction/session.
 // Sequential reads retain the same snapshot and avoid transaction-number races.
 const sets=[];
 if(session){
  for(const spec of specs)sets.push(await load(spec));
 }else{
  sets.push(...await Promise.all(specs.map(load)));
 }
 const maps=sets.map((rows,setIndex)=>{
  if(!Array.isArray(rows)||rows.length>100)
   fail("OFFLINE_RECONCILIATION_EVIDENCE_INVALID");
  // Snapshot every projected field; a malicious/stale Mongo adapter must not
  // make a row change identity, tenant, actor, amount or state via getters.
  const fields=["empresaId","sedeId","actorId","eventId",
   ...Object.keys(specs[setIndex][1])];
  const found=new Map();
  let ambiguousUnidentified=false;
  for(let i=0;i<rows.length;i++){
   const slot=Object.getOwnPropertyDescriptor(rows,String(i));
   if(!slot||!("value" in slot))
    fail("OFFLINE_RECONCILIATION_EVIDENCE_INVALID");
   const original=slot.value;
   if(!original||typeof original!=="object"||Array.isArray(original)){
    ambiguousUnidentified=true;
    continue;
   }
   const row={};
   for(const field of fields){
    const descriptor=Object.getOwnPropertyDescriptor(original,field);
    if(descriptor&&!("value" in descriptor))
     fail("OFFLINE_RECONCILIATION_EVIDENCE_INVALID");
    row[field]=descriptor?.value;
   }
   // Missing/duplicate event identities are ambiguous; never report completion.
   if(!row||typeof row!=="object"||typeof row.eventId!=="string"||
     !ULID.test(row.eventId)||!ids.includes(row.eventId)){
    ambiguousUnidentified=true;
    continue;
   }
   // Trust neither a stale cache nor an incorrectly scoped database adapter.
   // Returned financial evidence must independently prove the tenant and site.
   if(row.empresaId!==identity.empresaId||row.sedeId!==identity.sedeId){
    found.set(row.eventId,null);
    continue;
   }
   // A proof from a different actor within this tenant/site/event poisons the
   // result; never ignore it and report a falsely reconciled operation.
   if(found.has(row.eventId)||row.actorId!==identity.actorId)found.set(row.eventId,null);
   else found.set(row.eventId,row);
  }
  if(ambiguousUnidentified)for(const eventId of ids)found.set(eventId,null);
  return found;
 });
 const cop=x=>typeof x==="string"&&x.length<=16&&/^(0|[1-9][0-9]*)$/.test(x)&&
  BigInt(x)<=BigInt(Number.MAX_SAFE_INTEGER);
 return ids.map(eventId=>{
  const [inbox,sale,cash,ledger]=maps.map(m=>m.get(eventId));
  if(!inbox)return {eventId,status:"NO_ENCONTRADO",applied:false,staged:false,financiallyReconciled:false};
  if(!VALID_STATES.has(inbox.status))fail("OFFLINE_RECONCILIATION_EVIDENCE_INVALID");
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
