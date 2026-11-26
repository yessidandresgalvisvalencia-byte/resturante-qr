'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertUploadQuota}=require('../../scripts/gruk/drive-backup-quota');
test('quota reserves space and rejects absent or invalid provider data',()=>{
 const policy={reserve:100n,maxArchive:1000n};
 assert.doesNotThrow(()=>assertUploadQuota({limit:'1000',usage:'700'},200,policy));
 assert.throws(()=>assertUploadQuota({limit:'1000',usage:'701'},200,policy),/DRIVE_QUOTA_INSUFFICIENT/);
 for(const quota of [{},{limit:'1000'},{limit:'0',usage:'0'},{limit:'10',usage:'11'},{limit:'1e9',usage:'0'}])assert.throws(()=>assertUploadQuota(quota,200,policy),/DRIVE_QUOTA_UNVERIFIED/);
 assert.throws(()=>assertUploadQuota({limit:'10000',usage:'0'},1001,policy),/DRIVE_ARCHIVE_LIMIT/);
});
test('quota arithmetic remains exact above Number safe integer range',()=>{
 assert.throws(()=>assertUploadQuota({limit:'9007199254740993',usage:'9007199254740929'},64,{reserve:1n}),/DRIVE_QUOTA_INSUFFICIENT/);
});
