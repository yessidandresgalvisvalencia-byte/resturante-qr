"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {applyOfflineLegacyInventory:apply}=require("../../core/offline/offlineLegacyInventoryWriter.service");
const empresaId="507f191e810c19729de860ea",sedeId="507f1f77bcf86cd799439012",productoId="507f1f77bcf86cd799439011";
const context={empresaId,sedeId,actorId:"cajero"},inventoryDeltas=[{productoId,deltaUnidades:"-2"}];
function fixture({stock=5,records=1,persistedStock=3}={}){
 const session={inTransaction:()=>true};let writes=0;const rows=Array.from({length:records},(_,i)=>({_id:String(i),empresaId,sedeId,productoServicioId:productoId,anulado:false,cantidad:stock}));
 const db={collection(name){assert.equal(name,"inventarios");return{
  find:(key,opts)=>{assert.equal(opts.session,session);assert.equal(key.empresaId,empresaId);assert.equal(key.sedeId,sedeId);
   return {limit:n=>{assert.equal(n,2);return {toArray:async()=>rows};}};},
  findOne:async(key,opts)=>{assert.equal(opts.session,session);assert.ok(key._id!==undefined);return {_id:key._id,empresaId,sedeId,productoServicioId:productoId,anulado:false,cantidad:persistedStock};},
  updateOne:async(key,update,opts)=>{assert.equal(opts.session,session);assert.equal(key.cantidad,stock);
   assert.equal(update.$inc.cantidad,-2);writes++;return {matchedCount:1,modifiedCount:1};}
 };}};
 return {db,session,writes:()=>writes};
}
test("descuenta inventario legado con comparacion de cantidad y tenant",async()=>{
 const f=fixture();const out=await apply({...f,context,inventoryDeltas,objectId:x=>x});
 assert.deepEqual(out,[{productoId,antes:"5",despues:"3"}]);assert.equal(f.writes(),1);
});
test("rechaza stock insuficiente sin tocar documentos",async()=>{
 const f=fixture({stock:1});
 await assert.rejects(apply({...f,context,inventoryDeltas,objectId:x=>x}),e=>e.code==="OFFLINE_INVENTORY_INSUFFICIENT");
 assert.equal(f.writes(),0);
});
test("rechaza asociacion duplicada del producto sin descontar",async()=>{
 const f=fixture({records:2});
 await assert.rejects(apply({...f,context,inventoryDeltas,objectId:x=>x}),e=>e.code==="OFFLINE_INVENTORY_MAPPING_AMBIGUOUS");
 assert.equal(f.writes(),0);
});
test("rechaza ejecución fuera de transacción",async()=>{
 const f=fixture();await assert.rejects(apply({...f,session:{inTransaction:()=>false},context,inventoryDeltas,objectId:x=>x}),
 e=>e.code==="OFFLINE_INVENTORY_TRANSACTION_REQUIRED");assert.equal(f.writes(),0);
});

test("rechaza saldo persistido diferente aunque Mongo confirme updateOne",async()=>{
 const f=fixture({persistedStock:4});
 await assert.rejects(apply({...f,context,inventoryDeltas,objectId:x=>x}),
  e=>e.code==="OFFLINE_INVENTORY_PERSISTENCE_CONFLICT");
 assert.equal(f.writes(),1);
});
test("rechaza saldo persistido ausente o invalido",async()=>{
 for(const persistedStock of [null,-1,2.5]){
  const f=fixture({persistedStock});
  await assert.rejects(apply({...f,context,inventoryDeltas,objectId:x=>x}),
   e=>e.code==="OFFLINE_INVENTORY_PERSISTENCE_CONFLICT");
 }
});

test("Capa 2: a forged pre-debit record never allows inventory writes",async()=>{
 for(const patch of [{empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},
  {productoServicioId:"507f1f77bcf86cd799439014"},
  {empresaId:undefined},{anulado:true}]){
  let writes=0;
  const session={inTransaction:()=>true};
  const db={collection:()=>({
   find(){return {limit(){return {toArray:async()=>[{_id:"stock",empresaId,sedeId,
    productoServicioId:productoId,anulado:false,cantidad:5,...patch}]};}};},
   async updateOne(){writes++;throw Error("FORBIDDEN_WRITE");}
  })};
  await assert.rejects(apply({db,session,context,inventoryDeltas,objectId:x=>x}),
   {code:"OFFLINE_INVENTORY_MAPPING_AMBIGUOUS"});
  assert.equal(writes,0);
 }
});
test("Capa 2: post-debit verification rejects a different tenant, product or stock record",async()=>{
 for(const patch of [{empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"},
  {productoServicioId:"507f1f77bcf86cd799439014"},
  {_id:"stock-other"},{anulado:true},{empresaId:undefined}]){
  let writes=0;
  const original={_id:"stock-a",empresaId,sedeId,productoServicioId:productoId,
   anulado:false,cantidad:5};
  const db={collection:()=>({
   find(){return {limit(){return {toArray:async()=>[original]};}};},
   async updateOne(){writes++;return {matchedCount:1,modifiedCount:1};},
   async findOne(){return {...original,cantidad:3,...patch};}
  })};
  await assert.rejects(apply({db,session:{inTransaction:()=>true},context,
   inventoryDeltas,objectId:x=>x}),{code:"OFFLINE_INVENTORY_PERSISTENCE_CONFLICT"});
  assert.equal(writes,1);
 }
});

test("Capa 2: all product identifiers and units validated before any inventory access",async()=>{
 const session={inTransaction:()=>true};
 for(const invalid of [
  {productoId:"invalid",deltaUnidades:"-1"},
  {productoId:productoId.toUpperCase(),deltaUnidades:"-2"},
  {productoId:"507f1f77bcf86cd799439013",deltaUnidades:"0"},
  {productoId:"507f1f77bcf86cd799439013",deltaUnidades:"-9007199254740992"},
  {productoId:"507f1f77bcf86cd799439013",deltaUnidades:"-1.5"},
  {productoId:"507f1f77bcf86cd799439013",deltaUnidades:null}
 ]){
  let reads=0,writes=0;
  const db={collection(){reads++;return {
   find(){throw Error("UNEXPECTED_DB_READ");},
   updateOne(){writes++;throw Error("UNEXPECTED_DB_WRITE");}
  };}};
  await assert.rejects(apply({db,session,context,
   inventoryDeltas:[inventoryDeltas[0],invalid],objectId:x=>x}),
   {code:"OFFLINE_INVENTORY_INVALID_PLAN"});
  assert.equal(reads,0);
  assert.equal(writes,0);
 }
});
