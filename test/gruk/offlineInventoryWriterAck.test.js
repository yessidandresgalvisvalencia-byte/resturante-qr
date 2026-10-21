"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {applyOfflineLegacyInventory}=require("../../core/offline/offlineLegacyInventoryWriter.service");
const empresaId="507f191e810c19729de860ea",sedeId="507f1f77bcf86cd799439012";
const productoId="507f1f77bcf86cd799439011",rowId="507f1f77bcf86cd799439013";
const context={empresaId,sedeId,actorId:"operador"};
const inventoryDeltas=[{productoId,deltaUnidades:"-2"}];
function fixture(response){
 let writes=0,reads=0;
 const row={_id:rowId,empresaId,sedeId,productoServicioId:productoId,anulado:false,cantidad:5};
 return {get writes(){return writes;},get reads(){return reads;},db:{collection(name){
  assert.equal(name,"inventarios");
  return {
   find(query,options){
    reads++;assert.equal(query.empresaId,empresaId);assert.equal(query.sedeId,sedeId);
    assert.equal(options.session.inTransaction(),true);
    return {limit(n){assert.equal(n,2);return {toArray:async()=>[row]};}};
   },
   async updateOne(query,update,opts){
    writes++;assert.equal(query.empresaId,empresaId);assert.equal(query.sedeId,sedeId);
    assert.equal(update.$inc.cantidad,-2);assert.equal(opts.session.inTransaction(),true);
    return response;
   },
   async findOne(){return {...row,cantidad:3};}
  };
 }}};
}
const session={inTransaction:()=>true};
const objectId=value=>value;
test("Capa 2: inventario necesita acuse verdadero y coincidencia exacta",async()=>{
 for(const response of [undefined,null,{}, {matchedCount:1,modifiedCount:1},
  {acknowledged:false,matchedCount:1,modifiedCount:1},
  {acknowledged:1,matchedCount:1,modifiedCount:1},
  {acknowledged:true,matchedCount:0,modifiedCount:1},
  {acknowledged:true,matchedCount:1,modifiedCount:0}]){
  const f=fixture(response);
  await assert.rejects(applyOfflineLegacyInventory({db:f.db,session,context,inventoryDeltas,objectId}),
   {code:"OFFLINE_INVENTORY_CONCURRENT_CHANGE"});
  assert.equal(f.writes,1);assert.equal(f.reads,1);
 }
});
test("Capa 2: acuse válido y cantidad persistida generan balance exacto",async()=>{
 const f=fixture({acknowledged:true,matchedCount:1,modifiedCount:1});
 assert.deepEqual(await applyOfflineLegacyInventory({db:f.db,session,context,inventoryDeltas,objectId}),
  [{productoId,antes:"5",despues:"3"}]);
 assert.equal(f.writes,1);
});
