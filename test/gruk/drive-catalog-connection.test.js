'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateCatalogConnection,withCatalogStore}=require('../../scripts/gruk/drive-catalog-connection');
const config={catalogUri:'mongodb+srv://catalog:fake@catalog.example.mongodb.net/gruk_storage_catalog?tls=true',sourceUri:'mongodb+srv://source:fake@source.example.mongodb.net/restaurante',expectedHost:'catalog.example.mongodb.net'};
test('catalog preflight rejects shared endpoints, identity and unsafe options',()=>{
 assert.equal(validateCatalogConnection(config),true);
 for(const patch of [{expectedHost:'other.mongodb.net'},{catalogUri:config.catalogUri.replace('catalog.example','source.example')},{catalogUri:config.catalogUri.replace('catalog:','source:')},{catalogUri:config.catalogUri.replace('tls=true','tls=false')},{catalogUri:config.catalogUri.replace('gruk_storage_catalog','restaurante')}])assert.throws(()=>validateCatalogConnection({...config,...patch}),/CATALOG_ENDPOINT/);
});
test('connection closes on operation failure and invalid configuration never connects',async()=>{
 let calls=0,closed=0;
 const connect=async(_uri,opts)=>{calls++;assert.equal(opts.tls,true);return {db:{databaseName:'gruk_storage_catalog',collection(){return {}; }},async close(){closed++;}};};
 await assert.rejects(withCatalogStore(config,async()=>{throw Error('synthetic');},{connect}),/synthetic/);
 assert.equal(closed,1);
 await assert.rejects(withCatalogStore({...config,expectedHost:'wrong'},async()=>{}, {connect}),/CATALOG_ENDPOINT_SCOPE/);
 assert.equal(calls,1);
});
