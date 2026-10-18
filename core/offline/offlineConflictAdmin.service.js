"use strict";
// Read and append-only review decisions for offline stock conflicts.
// All access restricted by company + site + ADMIN role. Never changes inventory,
// inbox, sales, cash, ledger or the original conflict record.
const SHA=/^offline-stock-[a-f0-9]{64}$/,ULID=/^[0-9A-HJKMNP-TV-Z]{26}$/;
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const HEX=/^[a-fA-F0-9]{24}$/;
const ACTIONS=new Set(["ACUSAR_RECIBO","SOLICITAR_REABASTECIMIENTO","ESCALAR_AUDITORIA"]);
function fail(code){const e=new Error(code);e.code=code;throw e;}
function scope(auth){
 if(!auth||!["DUEÑO","ADMIN_SEDE"].includes(auth.rol)||
  !HEX.test(auth.empresaId||"")||!HEX.test(auth.sedeId||"")||
  typeof auth.usuarioId!=="string"||!ID.test(auth.usuarioId))
  fail("OFFLINE_CONFLICT_PERMISSION_DENIED");
 return Object.freeze({empresaId:auth.empresaId,sedeId:auth.sedeId});
}
async function listStockConflicts({db,auth,limit=50}){
 const tenant=scope(auth);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)fail("OFFLINE_CONFLICT_INVALID_LIMIT");
 if(typeof db?.collection!=="function")fail("OFFLINE_CONFLICT_DATABASE_UNAVAILABLE");
 const records=await db.collection("gruk_offline_stock_conflicts").find({
  ...tenant,status:"REQUIERE_REVISION"
 },{projection:{_id:1,empresaId:1,sedeId:1,actorId:1,eventIds:1,issues:1,createdAt:1,status:1},
  sort:{createdAt:-1,_id:1},limit}).toArray();
 if(!Array.isArray(records)||records.some(x=>
  x?.empresaId!==tenant.empresaId||x?.sedeId!==tenant.sedeId||
  x?.status!=="REQUIERE_REVISION"))fail("OFFLINE_CONFLICT_SCOPE_MISMATCH");
 return Object.freeze(records.filter(x=>SHA.test(x._id||"")).map(x=>Object.freeze({
  conflictId:x._id,actorId:x.actorId,eventIds:x.eventIds,issues:x.issues,
  status:x.status,createdAt:x.createdAt
 })));
}
async function appendStockConflictReview({db,auth,conflictId,decisionId,action,note}){
 const tenant=scope(auth);
 if(!SHA.test(conflictId||"")||!ULID.test(decisionId||"")||
  !ACTIONS.has(action)||typeof note!=="string"||
  note.trim().length<10||note.trim().length>500)
  fail("OFFLINE_CONFLICT_REVIEW_INVALID");
 if(typeof db?.collection!=="function")fail("OFFLINE_CONFLICT_DATABASE_UNAVAILABLE");
 const original=await db.collection("gruk_offline_stock_conflicts").findOne({
  _id:conflictId,...tenant,status:"REQUIERE_REVISION",applied:false,cobrado:false
 },{projection:{_id:1,empresaId:1,sedeId:1,status:1,applied:1,cobrado:1,issues:1}});
 if(!original||original._id!==conflictId||
  original.empresaId!==tenant.empresaId||original.sedeId!==tenant.sedeId||
  original.status!=="REQUIERE_REVISION"||original.applied!==false||
  original.cobrado!==false||!Array.isArray(original.issues)||original.issues.length===0)
  fail("OFFLINE_CONFLICT_NOT_FOUND");
 // One decision per client ULID, scoped to tenant+site. Unique _id guarantees
 // retries do not create another decision. No modification of original record.
 const reviews=db.collection("gruk_offline_stock_conflict_reviews");
 const key={_id:decisionId,...tenant};
 const record={...key,conflictId,action,note:note.trim(),
  reviewerId:auth.usuarioId,createdAt:new Date(),applied:false,cobrado:false};
 try{
  await reviews.updateOne(key,{$setOnInsert:record},{upsert:true});
 }catch(error){if(error?.code!==11000)throw error;}
 const persisted=await reviews.findOne(key,{projection:{
  _id:1,empresaId:1,sedeId:1,conflictId:1,action:1,note:1,reviewerId:1,applied:1,cobrado:1
 }});
 if(!persisted||persisted._id!==decisionId||
  persisted.empresaId!==tenant.empresaId||persisted.sedeId!==tenant.sedeId||
  persisted.conflictId!==conflictId||
  persisted.action!==action||persisted.note!==record.note||
  persisted.reviewerId!==auth.usuarioId||persisted.applied!==false||
  persisted.cobrado!==false)
  fail("OFFLINE_CONFLICT_REVIEW_IDEMPOTENCY_CONFLICT");
 return Object.freeze({decisionId,conflictId,action,status:"REVISION_REGISTRADA",
  applied:false,cobrado:false});
}
module.exports={listStockConflicts,appendStockConflictReview};
