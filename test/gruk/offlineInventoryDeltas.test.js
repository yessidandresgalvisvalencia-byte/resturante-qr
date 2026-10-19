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
