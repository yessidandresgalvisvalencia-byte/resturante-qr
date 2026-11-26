'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {discoverCatalogPage}=require('../../scripts/gruk/drive-catalog-discovery');
const names=['1','10','2'].map(n=>'gruk-restaurante-'+n+'-1.archive.age');
function fixture(rows){
 return {databaseName:'gruk_storage_catalog',collection(name){
  assert.equal(name,'signed_receipts');
  return {find(query,options){
   assert.equal(options.readConcern.level,'majority');
   assert.deepEqual(options.projection,{_id:1});
   const filtered=rows.filter(r=>!query._id||r._id>query._id.$gt);
   return {sort(s){assert.deepEqual(s,{_id:1});return this;},limit(n){return {async toArray(){return filtered.slice(0,n);}};}};
  }};
 }};
}
test('discovery uses bounded ordered pages without skipping the lookahead record',async()=>{
 const db=fixture(names.map(_id=>({_id})));
 const first=await discoverCatalogPage(db,{limit:2});
 assert.deepEqual(first,{names:names.slice(0,2),nextCursor:names[1]});
 assert.deepEqual(await discoverCatalogPage(db,{after:first.nextCursor,limit:2}),{names:[names[2]],nextCursor:null});
 assert.deepEqual(await discoverCatalogPage(fixture([])),{names:[],nextCursor:null});
});
test('discovery rejects foreign database, invalid cursor and malformed catalog rows',async()=>{
 await assert.rejects(discoverCatalogPage({...fixture([]),databaseName:'restaurante'}),/DISCOVERY_CONFIG/);
 await assert.rejects(discoverCatalogPage(fixture([]),{after:'bad'}),/DISCOVERY_CONFIG/);
 await assert.rejects(discoverCatalogPage(fixture([{_id:'foreign'}])),/DISCOVERY_UNVERIFIED/);
 await assert.rejects(discoverCatalogPage(fixture([]),{limit:11}),/DISCOVERY_CONFIG/);
});
