'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runReconciliation}=require('../../scripts/gruk/drive-reconciliation-runtime');
test('retired external reconciliation never reaches network or catalog',async()=>{
 await assert.rejects(runReconciliation({env:{GRUK_CATALOG_ENABLED:'true',GRUK_RECONCILIATION_ENABLED:'true'},connect:async()=>assert.fail(),fetchImpl:async()=>assert.fail(),alert:async()=>assert.fail()}),/EXTERNAL_INSPECTION_RETIRED/);
});
