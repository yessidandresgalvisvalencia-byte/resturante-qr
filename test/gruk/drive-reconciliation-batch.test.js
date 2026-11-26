'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBatchRunner}=require('../../scripts/gruk/drive-reconciliation-batch');
test('batch limits work, deduplicates names and aggregates warnings',async()=>{
 const a='gruk-restaurante-1-1.archive.age',b='gruk-restaurante-2-1.archive.age';
 let at=0,calls=0;const alerts=[];
 const run=createBatchRunner({now:()=>at,inspect:async name=>{calls++;return {name,status:'UPLOAD_NOT_CONFIRMED',restoreVerified:false};},alert:async e=>alerts.push(e)});
 const first=await run([a,a,b]);
 assert.equal(first.checked,2);assert.equal(calls,2);
 assert.equal(alerts.length,1);assert.equal(alerts[0].count,2);
 assert.equal((await run([a])).status,'SKIPPED');
 at+=86400000;assert.equal((await run([a])).checked,1);
 await assert.rejects(run(['../bad']),/BATCH_NAMES/);
});
test('overlapping runs are skipped and alert failure does not permit rapid retry',async()=>{
 const name='gruk-restaurante-1-1.archive.age';let release;
 const run=createBatchRunner({now:()=>0,inspect:()=>new Promise(r=>{release=r;}),alert:async()=>{throw Error('sink failure');}});
 const pending=run([name]);
 assert.equal((await run([name])).status,'SKIPPED');
 release({name,status:'REMOTE_UNAVAILABLE',restoreVerified:false});
 await assert.rejects(pending,/sink failure/);
 assert.equal((await run([name])).status,'SKIPPED');
});
