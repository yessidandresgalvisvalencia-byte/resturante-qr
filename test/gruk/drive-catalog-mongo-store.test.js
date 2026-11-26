'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMongoCatalogStore}=require('../../scripts/gruk/drive-catalog-mongo-store');
test('catalog adapter is create-only and scoped to independent catalog database',async()=>{
 const rows=new Map();
 const db={databaseName:'gruk_storage_catalog',collection(name){
  assert.equal(name,'signed_receipts');
  return {async insertOne(row,opts){
   assert.deepEqual(opts.writeConcern,{w:'majority',j:true,wtimeoutMS:10000});
   if(rows.has(row._id))throw Object.assign(Error('duplicate'),{code:11000});
   rows.set(row._id,row);return {acknowledged:true,insertedId:row._id};
  },async findOne(query,opts){assert.equal(opts.readConcern.level,'majority');return rows.get(query._id)||null;}};
 }};
 assert.throws(()=>createMongoCatalogStore({...db,databaseName:'restaurante'}),/CATALOG_DATABASE_SCOPE/);
 const store=createMongoCatalogStore(db),name='gruk-restaurante-1-1.archive.age';
 assert.equal(await store.get(name),null);
 assert.equal(await store.putIfAbsent(name,'receipt'),true);
 assert.equal(await store.putIfAbsent(name,'replacement'),false);
 assert.equal(await store.get(name),'receipt');
 await assert.rejects(store.get('../bad'),/CATALOG_NAME/);
 await assert.rejects(store.putIfAbsent(name,'x'.repeat(4097)),/CATALOG_INVALID/);
});
test('unacknowledged cloud writes fail closed',async()=>{
 const store=createMongoCatalogStore({databaseName:'gruk_storage_catalog',collection(){return {async insertOne(){return {acknowledged:false};}};}});
 await assert.rejects(store.putIfAbsent('gruk-restaurante-1-1.archive.age','receipt'),/CATALOG_WRITE_UNVERIFIED/);
});
