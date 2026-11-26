'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCoordinator}=require('../../scripts/gruk/drive-reconciliation-coordinator');
function fake(){
 let row;
 return {databaseName:'gruk_storage_catalog',collection(name){
  assert.equal(name,'reconciliation_control');
  return {async updateOne(q,u,o){
   assert.equal(o.writeConcern.w,'majority');
   if(o.upsert){
    if(row&&(row.active||row.nextAt>q.nextAt.$lte))throw Object.assign(Error('duplicate'),{code:11000});
    const existed=!!row;row={...row,...u.$set};return {acknowledged:true,modifiedCount:existed?1:0,upsertedCount:existed?0:1};
   }
   if(!row||row.owner!==q.owner||!row.active)return {acknowledged:true,modifiedCount:0};
   row={...row,...u.$set};delete row.owner;return {acknowledged:true,modifiedCount:1};
  }};
 }};
}
test('persistent reservation survives new coordinator instances and blocks overlap',async()=>{
 const db=fake();let at=0,release;
 const a=createCoordinator(db,{now:()=>at}),b=createCoordinator(db,{now:()=>at});
 const pending=a(()=>new Promise(r=>{release=r;}));
 await Promise.resolve();
 assert.deepEqual(await b(async()=>assert.fail()),{status:'SKIPPED'});
 release('done');assert.equal(await pending,'done');
 assert.deepEqual(await b(async()=>assert.fail()),{status:'SKIPPED'});
 at=86400000;assert.equal(await b(async()=>42),42);
});
test('failed operation keeps durable reservation for manual review',async()=>{
 const db=fake(),a=createCoordinator(db,{now:()=>0});
 await assert.rejects(a(async()=>{throw Error('interrupted');}),/interrupted/);
 const b=createCoordinator(db,{now:()=>172800000});
 assert.deepEqual(await b(async()=>assert.fail()),{status:'SKIPPED'});
 assert.throws(()=>createCoordinator({...db,databaseName:'restaurante'}),/COORDINATOR_CONFIG/);
});
