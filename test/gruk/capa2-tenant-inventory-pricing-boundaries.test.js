"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {applyOfflineLegacyInventory}=require("../../core/offline/offlineLegacyInventoryWriter.service");
const {assertOfflineAuthoritativePrices}=require("../../core/offline/offlineAuthoritativePrices.service");
const tenantA={empresaId:"aaaaaaaaaaaaaaaaaaaaaaaa",sedeId:"111111111111111111111111"};
const tenantB={empresaId:"bbbbbbbbbbbbbbbbbbbbbbbb",sedeId:"222222222222222222222222"};
const product="cccccccccccccccccccccccc";
const session={inTransaction:()=>true};
const objectId=value=>value;
const deltas=[{productoId:product,deltaUnidades:"-1"}];
function inventoryDb(rows){
 const queries=[];let writes=0;
 return {queries,get writes(){return writes;},collection(name){
  assert.equal(name,"inventarios");
  return {
   find(query,options){queries.push({type:"read",query,options});
    assert.equal(options.session,session);
    const matches=rows.filter(x=>Object.entries(query).every(([k,v])=>x[k]===v));
    return {limit(n){assert.equal(n,2);return {async toArray(){return matches;}};}};
   },
   async updateOne(query,change,options){
    queries.push({type:"write",query,options});assert.equal(options.session,session);
    const row=rows.find(x=>Object.entries(query).every(([k,v])=>x[k]===v));
    if(!row)return {matchedCount:0,modifiedCount:0};
    row.cantidad+=change.$inc.cantidad;writes++;
    return {matchedCount:1,modifiedCount:1};
   },
   async findOne(query,options){queries.push({type:"verify",query,options});
    assert.equal(options.session,session);
    return rows.find(x=>Object.entries(query).every(([k,v])=>x[k]===v))||null;
   }
  };
 }};
}
test("Capa 2: inventory never debits B product with A authenticated scope",async()=>{
 const foreign={_id:"stock-b",...tenantB,productoServicioId:product,anulado:false,cantidad:9};
 const source=inventoryDb([foreign]);
 await assert.rejects(applyOfflineLegacyInventory({db:source,session,context:tenantA,inventoryDeltas:deltas,objectId}),{code:"OFFLINE_INVENTORY_MAPPING_AMBIGUOUS"});
 assert.equal(source.writes,0);assert.equal(foreign.cantidad,9);
 assert.equal(source.queries.length,1);
 assert.equal(source.queries[0].query.empresaId,tenantA.empresaId);
 assert.equal(source.queries[0].query.sedeId,tenantA.sedeId);
});
test("Capa 2: stock updates and post-write verification retain tenant scope",async()=>{
 const local={_id:"stock-a",...tenantA,productoServicioId:product,anulado:false,cantidad:3};
 const foreign={_id:"stock-b",...tenantB,productoServicioId:product,anulado:false,cantidad:12};
 const source=inventoryDb([local,foreign]);
 const outcome=await applyOfflineLegacyInventory({db:source,session,context:tenantA,inventoryDeltas:deltas,objectId});
 assert.deepEqual(outcome,[{productoId:product,antes:"3",despues:"2"}]);
 assert.equal(local.cantidad,2);assert.equal(foreign.cantidad,12);
 assert.equal(source.writes,1);
 assert.deepEqual(source.queries.map(q=>q.type),["read","write","verify"]);
 for(const {query} of source.queries){
  assert.equal(query.empresaId,tenantA.empresaId);
  assert.equal(query.sedeId,tenantA.sedeId);
  assert.equal(query.productoServicioId,product);
 }
});
test("Capa 2: absent tenant context cannot touch inventory",async()=>{
 const db={collection(){throw Error("UNSCOPED_DATABASE_ACCESS");}};
 for(const context of [null,{}, {empresaId:tenantA.empresaId},{sedeId:tenantA.sedeId}]){
  await assert.rejects(applyOfflineLegacyInventory({db,session,context,inventoryDeltas:deltas,objectId}),{code:"OFFLINE_INVENTORY_TENANT_REQUIRED"});
 }
});
test("Capa 2: foreign product price cannot authenticate offline sale",async()=>{
 const queries=[];
 const db={collection(name){assert.equal(name,"productoservicios");return {
  find(query,options){queries.push(query);assert.equal(options.session,session);
   return {async toArray(){return [];}};}
 };}};
 const plan={orders:[{items:[{productoId:product,precioUnitarioCop:"5000"}]}]};
 await assert.rejects(assertOfflineAuthoritativePrices({db,session,context:tenantA,plan,objectId}),{code:"OFFLINE_AUTHORITATIVE_PRICE_CONFLICT"});
 assert.equal(queries.length,1);
 assert.equal(queries[0].empresaId,tenantA.empresaId);
 assert.equal(queries[0].sedeId,tenantA.sedeId);
 assert.deepEqual(queries[0]._id,{$in:[product]});
 assert.equal(queries[0].activo,true);
});
test("Capa 2: no tenant or transaction fails closed before reading prices",async()=>{
 const db={collection(){throw Error("UNSCOPED_PRICE_READ");}};
 const plan={orders:[{items:[{productoId:product,precioUnitarioCop:"5000"}]}]};
 for(const context of [null,{}, {empresaId:tenantA.empresaId},{sedeId:tenantA.sedeId}]){
  await assert.rejects(assertOfflineAuthoritativePrices({db,session,context,plan,objectId}),{code:"OFFLINE_AUTHORITATIVE_PRICE_CONFLICT"});
 }
 await assert.rejects(assertOfflineAuthoritativePrices({
   db,session:{inTransaction:()=>false},context:tenantA,plan,objectId
 }),{code:"OFFLINE_AUTHORITATIVE_PRICE_CONFLICT"});
});
