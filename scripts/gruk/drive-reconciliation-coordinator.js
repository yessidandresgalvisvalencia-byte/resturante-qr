'use strict';
// Persistent reservation: no automatic lease expiry or takeover. An interrupted
// run requires explicit operator reconciliation before another run is allowed.
const {randomUUID}=require('node:crypto');
const ID='enterprise-reconciliation';
function createCoordinator(db,{now=Date.now,intervalMs=86400000}={}){
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
  const result=await operation();
  const ended=now();
  if(!Number.isSafeInteger(ended)||ended<at||!Number.isSafeInteger(ended+intervalMs))throw Error('COORDINATOR_CLOCK');
  const release=await c.updateOne({_id:ID,active:true,owner},{$set:{active:false,nextAt:ended+intervalMs,completedAt:ended},$unset:{owner:''}},{writeConcern:wc});
  if(release.acknowledged!==true||release.modifiedCount!==1)throw Error('COORDINATOR_RELEASE_UNCONFIRMED');
  return result;
 };
}
module.exports={createCoordinator};
