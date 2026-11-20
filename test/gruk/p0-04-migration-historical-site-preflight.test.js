'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../scripts/gruk/p0-04-migration-historical-site-preflight.js'),'utf8');
class ObjectId {
  constructor(v) { this.v = v; }
  equals(other) { return other instanceof ObjectId && this.v === other.v; }
}
const enterprise = new ObjectId('enterprise');
const orderId = new ObjectId('order');
const date = new Date('2026-09-08T13:35:21Z');
const old = new Date('2026-08-27T18:01:12Z');
function exercise(overrides = {}) {
  const log = [];
  let writeAttempt = false;
  const sale = {empresaId:enterprise,sedeId:null,origen:'restaurante',origenId:orderId,metadata:{restaurantId:'yessid'}};
  const order = Object.assign({restaurantId:'yessid',createdAt:date}, overrides.order || {});
  const restaurant = {empresaId:enterprise,restaurantId:'yessid'};
  const site = Object.assign({empresaId:enterprise,restauranteId:'yessid',createdAt:old},overrides.site || {});
  const cols = {
    ventas: {find(){return {toArray(){return Array.from({length:16},()=>({...sale,...overrides.sale}));}}}},
    pedidos: {findOne(){return overrides.noOrder?null:order;}},
    restaurantes: {findOne(){return overrides.noRestaurant?null:restaurant;}},
    sedes: {find(){return {limit(){return {toArray(){return overrides.noSite?[]:[site];}}}};}}
  };
  const guarded = new Proxy(cols,{get(target,key){const coll=target[key];return new Proxy(coll,{get(obj,method){if (/^(insert|update|delete|replace|bulkWrite|drop)/i.test(method)) {writeAttempt=true;throw new Error('write prohibited');}return obj[method];}});}});
  const context = {ObjectId,Date,process:{env:{GRUK_ENTERPRISE_DB:'restaurante',GRUK_ENTERPRISE_DB_CONFIRM:'restaurante'}},db:{getSiblingDB(n){assert.equal(n,'restaurante');return {getCollection(k){return guarded[k];}}}},printjson(x){log.push(x);}};
  let err=null;
  try {vm.runInNewContext(source,context,{timeout:1000});} catch(e){err=e;}
  return {log:log[0],err,writeAttempt};
}
test('historically matching 16 sales are read only and reported as eligible for further review',()=>{
  const r=exercise();
  assert.equal(r.err,null);
  assert.equal(r.writeAttempt,false);
  assert.equal(r.log.legacySales,16);
  assert.equal(r.log.uniqueHistoricSite,16);
  assert.equal(r.log.readyForCorrection,true);
});
test('blocks sites created after the order',()=>{
  const r=exercise({site:{createdAt:new Date('2026-10-01')}});
  assert.ok(r.err);
  assert.equal(r.log.siteCreatedAfterOrder,16);
  assert.equal(r.log.readyForCorrection,false);
});
test('blocks missing orders',()=>{
  const r=exercise({noOrder:true});
  assert.ok(r.err);
  assert.equal(r.log.missingOrder,16);
});
test('blocks missing restaurants',()=>{
  const r=exercise({noRestaurant:true});
  assert.ok(r.err);
  assert.equal(r.log.missingRestaurant,16);
});
test('blocks absent site match',()=>{
  const r=exercise({noSite:true});
  assert.ok(r.err);
  assert.equal(r.log.ambiguousSite,16);
});
test('blocks mismatch between sale metadata and original restaurant',()=>{
  const r=exercise({sale:{metadata:{restaurantId:'wrong'}}});
  assert.ok(r.err);
  assert.equal(r.log.otherUnsafe,16);
});
