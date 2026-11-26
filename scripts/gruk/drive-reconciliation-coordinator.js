'use strict';
// Persistent reservation: no automatic lease expiry or takeover. An interrupted
// run requires explicit operator reconciliation before another run is allowed.
const {randomUUID}=require('node:crypto');
const ID='enterprise-reconciliation';
function createCoordinator(db,{now=Date.now,intervalMs=86400000,audit,discover}={}){
 if(db?.databaseName!=='gruk_storage_catalog'||!Number.isSafeInteger(intervalMs)||intervalMs<3600000)throw Error('COORDINATOR_CONFIG');
 const c=db.collection('reconciliation_control');
 const wc={w:'majority',j:true,wtimeoutMS:10000};
 return async function run(operation){
  if(typeof operation!=='function')throw Error('COORDINATOR_OPERATION');
  const at=now(),owner=randomUUID();
  if(!Number.isSafeInteger(at)||at<0)throw Error('COORDINATOR_CLOCK');
  try{
   const result=await c.updateOne({_id:ID,active:false,nextAt:{$lte:at}},{$set:{active:true,owner,startedAt:at}},{upsert:true,writeConcern:wc});
   if(result.acknowledged!==true||result.modifiedCount+result.upsertedCount!==1)throw Error('COORDINATOR_UNCONFIRMED');
  }catch(e){if(e?.code===11000)return {status:'SKIPPED'};throw e;}
  // Fail closed on interruption or uncertain completion: retain the reservation.
  if(audit)await audit({type:'INSPECTION_STARTED',owner,at,evidenceId:owner});
  let page;
  if(discover){
   const state=await c.findOne({_id:ID,active:true,owner},{projection:{cursor:1},readConcern:{level:'majority'},readPreference:'primary',maxTimeMS:10000});
   if(!state)throw Error('COORDINATOR_CURSOR_UNVERIFIED');
   page=await discover(state.cursor===undefined?null:state.cursor);
   const valid=n=>typeof n==='string'&&/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/.test(n);
   if(!page||!Array.isArray(page.names)||page.names.length>10||page.names.some(n=>!valid(n))||(page.nextCursor!==null&&(!valid(page.nextCursor)||page.nextCursor!==page.names[page.names.length-1])))throw Error('COORDINATOR_PAGE_INVALID');
  }
  const result=await operation(page);
  if(page&&(!result||result.status!=='COMPLETED'||result.checked!==page.names.length||result.restoreVerified!==false))throw Error('COORDINATOR_PAGE_INCOMPLETE');
  const ended=now();
  if(!Number.isSafeInteger(ended)||ended<at||!Number.isSafeInteger(ended+intervalMs))throw Error('COORDINATOR_CLOCK');
  if(audit)await audit({type:'INSPECTION_COMPLETED',owner,at:ended,evidenceId:owner});
  const release=await c.updateOne({_id:ID,active:true,owner},{$set:{active:false,nextAt:ended+intervalMs,completedAt:ended,...(page?{cursor:page.nextCursor}:{})},$unset:{owner:''}},{writeConcern:wc});
  if(release.acknowledged!==true||release.modifiedCount!==1)throw Error('COORDINATOR_RELEASE_UNCONFIRMED');
  return result;
 };
}
// Recovery is an operator action, never an automatic expiration. The caller must
// independently establish that the previous worker has actually terminated.
async function recoverInterrupted(db,{owner,startedAt,approval,evidenceId,now=Date.now,audit}={}){
 if(db?.databaseName!=='gruk_storage_catalog'||approval!=='CONFIRM_WORKER_TERMINATED'||typeof owner!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(owner)||!Number.isSafeInteger(startedAt)||startedAt<0||typeof evidenceId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(evidenceId))throw Error('COORDINATOR_RECOVERY_CONFIG');
 const at=now();
 if(!Number.isSafeInteger(at)||at-startedAt<3600000||!Number.isSafeInteger(at+86400000))throw Error('COORDINATOR_RECOVERY_TOO_EARLY');
 const c=db.collection('reconciliation_control');
 if(audit)await audit({type:'RECOVERY_REQUESTED',owner,at,evidenceId});
 const result=await c.updateOne({_id:ID,active:true,owner,startedAt},{$set:{active:false,nextAt:at+86400000,lastRecovery:{owner,startedAt,at,evidenceId}},$unset:{owner:''}},{writeConcern:{w:'majority',j:true,wtimeoutMS:10000}});
 if(result.acknowledged!==true||result.modifiedCount!==1)throw Error('COORDINATOR_RECOVERY_UNCONFIRMED');
 if(audit)await audit({type:'RECOVERY_COMPLETED',owner,at,evidenceId});
 return {status:'RECOVERED',nextAt:at+86400000};
}
module.exports={createCoordinator,recoverInterrupted};
