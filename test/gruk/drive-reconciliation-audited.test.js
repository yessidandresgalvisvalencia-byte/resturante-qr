'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCoordinator,recoverInterrupted}=require('../../scripts/gruk/drive-reconciliation-coordinator');
test('inspection audit precedes execution and release',async()=>{
 const order=[];
 const db={databaseName:'gruk_storage_catalog',collection(){return {async updateOne(q,u,o){order.push(o.upsert?'reserve':'release');return {acknowledged:true,modifiedCount:1,upsertedCount:0};}};}};
 const run=createCoordinator(db,{now:()=>0,audit:async e=>order.push(e.type)});
 await run(async()=>order.push('inspect'));
 assert.deepEqual(order,['reserve','INSPECTION_STARTED','inspect','INSPECTION_COMPLETED','release']);
 order.length=0;
 const broken=createCoordinator(db,{now:()=>0,audit:async()=>{throw Error('audit failed');}});
 await assert.rejects(broken(async()=>assert.fail()),/audit failed/);
 assert.deepEqual(order,['reserve']);
});
test('manual recovery writes request before conditional update and completion after',async()=>{
 const order=[];
 const db={databaseName:'gruk_storage_catalog',collection(){return {async updateOne(){order.push('update');return {acknowledged:true,modifiedCount:1};}};}};
 await recoverInterrupted(db,{owner:'12345678-1234-4123-8123-123456789abc',startedAt:0,approval:'CONFIRM_WORKER_TERMINATED',evidenceId:'incident-123',now:()=>3600000,audit:async e=>order.push(e.type)});
 assert.deepEqual(order,['RECOVERY_REQUESTED','update','RECOVERY_COMPLETED']);
});
