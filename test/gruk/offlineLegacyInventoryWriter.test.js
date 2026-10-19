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

test("Capa 2: identity substitution in Mongo ObjectId conversion is rejected before inventory access",async()=>{
 const replacement="507f1f77bcf86cd799439099";
 const secondProduct="507f1f77bcf86cd799439013";
 const plan=[inventoryDeltas[0],{productoId:secondProduct,deltaUnidades:"-1"}];
 for(const target of [empresaId,sedeId,productoId,secondProduct]){
  let reads=0,writes=0;
  const db={collection(){reads++;return {updateOne(){writes++;throw Error("FORBIDDEN_WRITE");}};}};
  await assert.rejects(apply({db,session:{inTransaction:()=>true},context,
   inventoryDeltas:plan,objectId:value=>value===target?replacement:value}),
   {code:"OFFLINE_INVENTORY_TENANT_REQUIRED"});
  assert.equal(reads,0);assert.equal(writes,0);
 }
 for(const objectId of [()=>null,()=>undefined,()=>{throw Error("INVALID_CONVERTER");}]){
  let reads=0;
  const db={collection(){reads++;throw Error("FORBIDDEN_READ");}};
  await assert.rejects(apply({db,session:{inTransaction:()=>true},context,
   inventoryDeltas,objectId}),{code:"OFFLINE_INVENTORY_TENANT_REQUIRED"});
  assert.equal(reads,0);
 }
});

test("Capa 2: rejects oversized offline inventory deltas before Mongo access",async()=>{
 const invalidUnits=["-9007199254740992","-999999999999999999999999999999999999","-"+("9".repeat(10000))];
 for(const deltaUnidades of invalidUnits){
  let reads=0,writes=0;
  const db={collection(){reads++;return {updateOne(){writes++;throw Error("FORBIDDEN_WRITE");}};}};
  await assert.rejects(apply({db,session:{inTransaction:()=>true},context,
   inventoryDeltas:[inventoryDeltas[0],{productoId:"507f1f77bcf86cd799439013",deltaUnidades}],
   objectId:x=>x}),{code:"OFFLINE_INVENTORY_INVALID_PLAN"});
  assert.equal(reads,0);assert.equal(writes,0);
 }
});

test("Capa 2: missing or blank legacy inventory record identifiers never reach updateOne",async()=>{
 for(const id of [undefined,null,"","  "]){
  let writes=0;
  const db={collection:()=>({
   find(){return {limit(){return {toArray:async()=>[{
    _id:id,empresaId,sedeId,productoServicioId:productoId,anulado:false,cantidad:5
   }]};}};},
   updateOne(){writes++;throw Error("FORBIDDEN_WRITE");}
  })};
  await assert.rejects(apply({db,session:{inTransaction:()=>true},context,
    inventoryDeltas,objectId:x=>x}),{code:"OFFLINE_INVENTORY_MAPPING_AMBIGUOUS"});
  assert.equal(writes,0);
 }
});
test("Capa 2: invalid inventory result set fails closed without writes",async()=>{
 for(const records of [null,{},undefined]){
  let writes=0;
  const db={collection:()=>({
   find(){return {limit(){return {toArray:async()=>records};}};},
   updateOne(){writes++;throw Error("FORBIDDEN_WRITE");}
  })};
  await assert.rejects(apply({db,session:{inTransaction:()=>true},context,
    inventoryDeltas,objectId:x=>x}),{code:"OFFLINE_INVENTORY_MAPPING_AMBIGUOUS"});
  assert.equal(writes,0);
 }
});

test("Capa 2: rejects nonstring tenant identifiers before Mongo or ObjectId adapter",async()=>{
 for(const field of ["empresaId","sedeId"]){
  for(const invalid of [null,undefined,123,{},[],{toString:()=>context[field]}]){
   let reads=0, conversions=0;
   const db={collection(){reads++;throw Error("FORBIDDEN_DB_READ");}};
   await assert.rejects(apply({db,session:{inTransaction:()=>true},
    context:{...context,[field]:invalid},inventoryDeltas,
    objectId:()=>{conversions++;throw Error("FORBIDDEN_CONVERSION");}}),
    {code:"OFFLINE_INVENTORY_TENANT_REQUIRED"});
   assert.equal(reads,0);assert.equal(conversions,0);
  }
 }
});

test("Capa 2: two offline tablets racing for last unit cannot debit it twice",async()=>{
 let remaining=1,writes=0;
 const bothRead=[];
 let releaseReads;
 const gate=new Promise(resolve=>{releaseReads=resolve;});
 const db={collection(name){
  assert.equal(name,"inventarios");
  return {
   find(key,options){
    assert.equal(key.empresaId,empresaId);
    assert.equal(key.sedeId,sedeId);
    assert.equal(key.productoServicioId,productoId);
    assert.equal(options.session.inTransaction(),true);
    return {limit(n){
     assert.equal(n,2);
     return {async toArray(){
      const observed=remaining;
      bothRead.push(observed);
      if(bothRead.length===2)releaseReads();
      await gate;
      return [{_id:"shared-stock",empresaId,sedeId,productoServicioId:productoId,anulado:false,cantidad:observed}];
     }};
    }};
   },
   async updateOne(key,update,options){
    assert.equal(options.session.inTransaction(),true);
    assert.equal(update.$inc.cantidad,-1);
    if(remaining!==key.cantidad)return {matchedCount:0,modifiedCount:0};
    remaining--;writes++;
    return {matchedCount:1,modifiedCount:1};
   },
   async findOne(key){
    return {_id:key._id,empresaId,sedeId,productoServicioId:productoId,
      anulado:false,cantidad:remaining};
   }
  };
 }};
 const tablet=()=>apply({db,session:{inTransaction:()=>true},context,
  inventoryDeltas:[{productoId,deltaUnidades:"-1"}],objectId:x=>x});
 const outcomes=await Promise.allSettled([tablet(),tablet()]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(outcomes.filter(x=>x.status==="rejected"&&
   x.reason.code==="OFFLINE_INVENTORY_CONCURRENT_CHANGE").length,1);
 assert.deepEqual(bothRead,[1,1]);
 assert.equal(writes,1);
 assert.equal(remaining,0);
});
test("Capa 2: absent Mongo conditional update result is a controlled conflict",async()=>{
 const db={collection:()=>({
  find:()=>({limit:()=>({toArray:async()=>[{_id:"stock",empresaId,sedeId,
   productoServicioId:productoId,anulado:false,cantidad:1}]})}),
  updateOne:async()=>null,
  findOne:()=>{throw Error("FORBIDDEN_RECHECK");}
 })};
 await assert.rejects(apply({db,session:{inTransaction:()=>true},context,
  inventoryDeltas:[{productoId,deltaUnidades:"-1"}],objectId:x=>x}),
  {code:"OFFLINE_INVENTORY_CONCURRENT_CHANGE"});
});
