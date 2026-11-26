'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAudit}=require('../../scripts/gruk/drive-reconciliation-audit');
test('audit uses create-only events, verifies readback and rejects conflicting history',async()=>{
 const rows=new Map();
 const db={databaseName:'gruk_storage_catalog',collection(name){
  assert.equal(name,'reconciliation_audit');
  return {async insertOne(row,opts){
   assert.equal(opts.writeConcern.w,'majority');
   if(rows.has(row._id))throw Object.assign(Error('duplicate'),{code:11000});
   rows.set(row._id,row);return {acknowledged:true,insertedId:row._id};
  },async findOne(q){return rows.get(q._id)||null;}};
 }};
 const append=createAudit(db),event={type:'RECOVERY_REQUESTED',owner:'12345678-1234-4123-8123-123456789abc',at:100,evidenceId:'incident-123'};
 const id=await append(event);
 assert.equal(await append(event),id);
 assert.equal(rows.size,1);
 await assert.rejects(append({...event,at:200}),/AUDIT_CONFLICT/);
 await append({...event,type:'RECOVERY_COMPLETED',at:300});
 assert.equal(rows.size,2);
 await assert.rejects(append({...event,secret:'forbidden'}),/AUDIT_EVENT_INVALID/);
 assert.throws(()=>createAudit({...db,databaseName:'restaurante'}),/AUDIT_DATABASE_SCOPE/);
});
