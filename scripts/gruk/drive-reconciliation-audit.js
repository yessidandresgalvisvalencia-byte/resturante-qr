'use strict';
const {createHash}=require('node:crypto');
const TYPES=new Set(['INSPECTION_STARTED','INSPECTION_COMPLETED','RECOVERY_REQUESTED','RECOVERY_COMPLETED']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function createAudit(db){
 if(db?.databaseName!=='gruk_storage_catalog')throw Error('AUDIT_DATABASE_SCOPE');
 const c=db.collection('reconciliation_audit');
 return async function append(event){
  if(!event||Object.keys(event).sort().join(',')!=='at,evidenceId,owner,type'||!TYPES.has(event.type)||typeof event.owner!=='string'||!UUID.test(event.owner)||!Number.isSafeInteger(event.at)||event.at<0||typeof event.evidenceId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(event.evidenceId))throw Error('AUDIT_EVENT_INVALID');
  const payload={version:1,type:event.type,owner:event.owner,at:event.at,evidenceId:event.evidenceId};
  const id=createHash('sha256').update(JSON.stringify([payload.owner,payload.type])).digest('hex');
  const row={_id:id,...payload};
  try{
   const result=await c.insertOne(row,{writeConcern:{w:'majority',j:true,wtimeoutMS:10000}});
   if(result.acknowledged!==true||result.insertedId!==id)throw Error('AUDIT_WRITE_UNCONFIRMED');
  }catch(error){if(error?.code!==11000)throw error;}
  const stored=await c.findOne({_id:id},{readConcern:{level:'majority'},readPreference:'primary',maxTimeMS:10000});
  if(!stored||Object.keys(stored).length!==Object.keys(row).length||Object.keys(row).some(k=>stored[k]!==row[k]))throw Error('AUDIT_CONFLICT');
  return id;
 };
}
module.exports={createAudit};
