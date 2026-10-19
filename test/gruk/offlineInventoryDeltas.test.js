"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {calculateOfflineStockDeltas:calculate}=require("../../core/offline/offlineInventoryDeltas.service");
test("dos tablets offline con stock inicial uno: plan conserva venta de dos y stock -1",()=>{
 const plan={orders:[
  {items:[{productoId:"producto1",cantidad:"1"}]},
  {items:[{productoId:"producto1",cantidad:"1"}]}
 ]};
 const movements=calculate(plan);
 assert.deepEqual(movements,[{productoId:"producto1",deltaUnidades:"-2"}]);
 const initial=1n;
 assert.equal((initial+BigInt(movements[0].deltaUnidades)).toString(),"-1");
});
test("varios renglones del mismo producto acumulan sin duplicar",()=>{
 const movements=calculate({orders:[{items:[
  {productoId:"prod1",cantidad:"2"},
  {productoId:"prod2",cantidad:"3"},
  {productoId:"prod1",cantidad:"1"}]}]});
 assert.deepEqual(movements,[{productoId:"prod1",deltaUnidades:"-3"},{productoId:"prod2",deltaUnidades:"-3"}]);
});
test("no permite cantidades negativas, floats ni desbordamiento acumulado",()=>{
 for(const qty of ["0","-1","1.5",1, "9007199254740992"]){
  assert.throws(()=>calculate({orders:[{items:[{productoId:"prod1",cantidad:qty}]}]}),e=>e.code==="OFFLINE_STOCK_PLAN_INVALID");
 }
 assert.throws(()=>calculate({orders:[{items:[
  {productoId:"prod1",cantidad:"9007199254740991"},
  {productoId:"prod1",cantidad:"1"}]}]}),e=>e.code==="OFFLINE_STOCK_PLAN_INVALID");
});

test("Capa 2: cantidades de 10000 digitos se rechazan antes de calcular deltas",()=>{
 for(const cantidad of ["9".repeat(10000),"1".repeat(10000)+"x","0".repeat(10000)]){
  assert.throws(()=>calculate({orders:[{items:[{productoId:"prod1",cantidad}]}]}),
    {code:"OFFLINE_STOCK_PLAN_INVALID"});
 }
 assert.deepEqual(calculate({orders:[{items:[{productoId:"prod1",cantidad:"9007199254740991"}]}]}),
  [{productoId:"prod1",deltaUnidades:"-9007199254740991"}]);
});

test("Capa 2: planes masivos de stock fallan antes de acumular unidades",()=>{
 const item={productoId:"prod1",cantidad:"1"};
 for(const orders of [
  Array.from({length:1001},()=>({items:[item]})),
  [{items:Array.from({length:10001},()=>item)}],
  Array.from({length:11},()=>({items:Array.from({length:1000},()=>item)}))
 ]){
  assert.throws(()=>calculate({orders}),{code:"OFFLINE_STOCK_PLAN_INVALID"});
 }
 assert.deepEqual(calculate({orders:[{items:[item]},{items:[item]}]}),
  [{productoId:"prod1",deltaUnidades:"-2"}]);
});

test("Capa 2: pedidos y renglones dispersos no se omiten silenciosamente",()=>{
 const item={productoId:"prod1",cantidad:"1"};
 const sparseOrders=[{items:[item]},,{items:[item]}];
 const sparseItems=[item,,item];
 for(const orders of [
  sparseOrders,
  [{items:sparseItems}],
  new Array(1),
  [{items:new Array(2)}]
 ]){
  assert.throws(()=>calculate({orders}),{code:"OFFLINE_STOCK_PLAN_INVALID"});
 }
 assert.deepEqual(calculate({orders:[{items:[item]},{items:[item]}]}),
  [{productoId:"prod1",deltaUnidades:"-2"}]);
});
