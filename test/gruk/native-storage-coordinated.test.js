'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBatchRunner}=require('../../scripts/gruk/drive-reconciliation-batch');
const {runCoordinated}=require('../../scripts/gruk/drive-reconciliation-coordinated');
test('native anomalies preserve classification and never assert restore',async()=>{
 const alerts=[];
 const name='gruk-restaurante-1-1.archive.age';
 const run=createBatchRunner({inspect:async()=>({name,status:'ARCHIVE_DIGEST_MISMATCH',restoreVerified:false}),alert:async e=>alerts.push(e),now:()=>0});
 assert.deepEqual(await run([name]),{status:'COMPLETED',checked:1,counts:{ARCHIVE_DIGEST_MISMATCH:1},restoreVerified:false});
 assert.equal(alerts[0].code,'ARCHIVE_DIGEST_MISMATCH');
});
test('native coordination rejects missing configuration before network',async()=>{
 const env={GRUK_CATALOG_ENABLED:'true',GRUK_RECONCILIATION_ENABLED:'true',GRUK_COORDINATED_INSPECTION_ENABLED:'true',GRUK_STORAGE_INSPECTION_PROVIDER:'native'};
 await assert.rejects(runCoordinated({env,connect:async()=>assert.fail(),alert:async()=>assert.fail(),fetchImpl:async()=>assert.fail()}),/NATIVE_INSPECTION_CONFIG/);
 await assert.rejects(runCoordinated({env:{...env,GRUK_STORAGE_INSPECTION_PROVIDER:'unknown'},connect:async()=>assert.fail(),alert:async()=>assert.fail()}),/INSPECTION_PROVIDER_INVALID/);
});
