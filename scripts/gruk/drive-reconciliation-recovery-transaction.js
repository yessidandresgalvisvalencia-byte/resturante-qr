'use strict';
const {createHash}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// This path requires a transaction-capable independent deployment.
async function recoverAtomically({client,db,owner,startedAt,approval,evidenceId,now=Date.now}){
 if(db?.databaseName!=='gruk_storage_catalog'||typeof client?.startSession!=='function'||approval!=='CONFIRM_WORKER_TERMINATED'||typeof owner!=='string'||!UUID.test(owner)||!Number.isSafeInteger(startedAt)||startedAt<0||typeof evidenceId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(evidenceId))throw Error('RECOVERY_TRANSACTION_CONFIG');
 const at=now(),nextAt=at+86400000;
 if(!Number.isSafeInteger(at)||at-startedAt<3600000||!Number.isSafeInteger(nextAt))throw Error('RECOVERY_TRANSACTION_CLOCK');
 const session=client.startSession();
 try{
  return await session.withTransaction(async()=>{
   const control=db.collection('reconciliation_control'),audit=db.collection('reconciliation_audit');
   const result=await control.updateOne({_id:'enterprise-reconciliation',active:true,owner,startedAt},{$set:{active:false,nextAt,lastRecovery:{owner,startedAt,at,evidenceId}},$unset:{owner:''}},{session});
   if(result.acknowledged!==true||result.modifiedCount!==1)throw Error('RECOVERY_TRANSACTION_CONFLICT');
   for(const type of ['RECOVERY_REQUESTED','RECOVERY_COMPLETED']){
    const _id=createHash('sha256').update(JSON.stringify([owner,type])).digest('hex');
    const row={_id,version:1,type,owner,at,evidenceId};
    const inserted=await audit.insertOne(row,{session});
    if(inserted.acknowledged!==true||inserted.insertedId!==_id)throw Error('RECOVERY_TRANSACTION_AUDIT_FAILED');
   }
   return {status:'RECOVERED',nextAt};
  },{readConcern:{level:'snapshot'},writeConcern:{w:'majority',j:true,wtimeoutMS:10000},readPreference:'primary',maxCommitTimeMS:10000});
 }finally{await session.endSession();}
}
module.exports={recoverAtomically};
