'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runCoordinated}=require('../../scripts/gruk/drive-reconciliation-coordinated');
test('coordinated inspection rejects disabled or invalid inputs and skips reserved work',async()=>{
 const env={GRUK_CATALOG_ENABLED:'true',GRUK_RECONCILIATION_ENABLED:'true',GRUK_COORDINATED_INSPECTION_ENABLED:'true',GRUK_CATALOG_MONGO_URI:'mongodb+srv://catalog:fake@catalog.example.mongodb.net/gruk_storage_catalog',GRUK_ENTERPRISE_BACKUP_URI:'mongodb+srv://source:fake@source.example.mongodb.net/restaurante',GRUK_CATALOG_EXPECTED_HOST:'catalog.example.mongodb.net'};
 let connections=0,closed=0;
 const connect=async()=>{connections++;return {db:{databaseName:'gruk_storage_catalog',collection(name){assert.equal(name,'reconciliation_control');return {async updateOne(){throw Object.assign(Error('duplicate'),{code:11000});}};}},async close(){closed++;}};};
 const args={names:['gruk-restaurante-1-1.archive.age'],env,connect,alert:async()=>assert.fail(),fetchImpl:async()=>assert.fail(),now:()=>0};
 await assert.rejects(runCoordinated({...args,env:{...env,GRUK_COORDINATED_INSPECTION_ENABLED:'false'}}),/COORDINATED_DISABLED/);
 await assert.rejects(runCoordinated({...args,names:['invalid']}),/BATCH_NAMES/);
 assert.equal(connections,0);
 assert.deepEqual(await runCoordinated(args),{status:'SKIPPED'});
 assert.equal(connections,1);assert.equal(closed,1);
});
