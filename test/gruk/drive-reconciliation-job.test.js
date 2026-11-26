'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runJob}=require('../../scripts/gruk/drive-reconciliation-job');
const name='gruk-restaurante-1-1.archive.age';
const env={GRUK_INSPECTION_JOB_ENABLED:'true',GRUK_COORDINATED_INSPECTION_ENABLED:'true',GRUK_RECONCILIATION_ENABLED:'true',GRUK_CATALOG_ENABLED:'true',GRUK_INSPECTION_ARCHIVES:JSON.stringify([name,name])};
test('job gates all access, bounds and deduplicates inputs',async()=>{
 const run=async()=>assert.fail('unexpected inspection');
 await assert.rejects(runJob({env:{...env,GRUK_INSPECTION_JOB_ENABLED:'false'},run}),/DISABLED/);
 await assert.rejects(runJob({env:{...env,GRUK_INSPECTION_ARCHIVES:'["bad"]'},run}),/INPUT/);
 const result=await runJob({env,run:async args=>{assert.deepEqual(args.names,[name]);return {status:'COMPLETED',checked:1,counts:{RESTORE_VERIFICATION_REQUIRED:1},restoreVerified:false};}});
 assert.deepEqual(result,{status:'METADATA_MATCH',checked:1,restoreVerified:false});
});
test('job distinguishes anomalies and skips without claiming recovery',async()=>{
 assert.equal((await runJob({env,run:async()=>({status:'SKIPPED'})})).status,'SKIPPED');
 assert.equal((await runJob({env,run:async()=>({status:'COMPLETED',checked:1,counts:{REMOTE_UNAVAILABLE:1},restoreVerified:false})})).status,'ANOMALIES');
 await assert.rejects(runJob({env,run:async()=>({status:'COMPLETED',checked:1,counts:{},restoreVerified:false})}),/RESULT/);
});
