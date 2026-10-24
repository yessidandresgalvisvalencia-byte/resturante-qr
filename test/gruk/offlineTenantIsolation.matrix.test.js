"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineOrderCandidates}=require("../../core/offline/offlinePostingCandidates.service");

const identity=[
  {empresaId:"empresaA",sedeId:"sede1",actorId:"cajero1"},
  {empresaId:"empresaA",sedeId:"sede2",actorId:"cajero1"},
  {empresaId:"empresaA",sedeId:"sede1",actorId:"cajero2"},
  {empresaId:"empresaB",sedeId:"sede1",actorId:"cajero1"}
];
const ids=[
  "01ARZ3NDEKTSV4RRFFQ69G5FA0",
  "01ARZ3NDEKTSV4RRFFQ69G5FA1",
  "01ARZ3NDEKTSV4RRFFQ69G5FA2",
  "01ARZ3NDEKTSV4RRFFQ69G5FA3"
];
const records=identity.map((scope,i)=>({
  ...scope,eventId:ids[i],tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",
  payload:{localOrderId:ids[i],items:[{
    productoId:"prod"+i,cantidad:"2",precioUnitarioCop:"1500",totalCop:"3000"
  }],totalCop:"3000"}
}));
function scopedDb(records,observe){
  return {collection(name){
    assert.equal(name,"gruk_offline_inbox");
    return {find(query,opts){
      observe?.(query,opts);
      return {toArray:async()=>records.filter(r=>
        r.empresaId===query.empresaId&&r.sedeId===query.sedeId&&
        r.actorId===query.actorId&&r.tipo===query.tipo&&
        r.status===query.status&&query.eventId.$in.includes(r.eventId)
      )};
    }};
  }};
}
test("Capa 2 ofensiva: cada empresa, sede y actor accede solo a su pedido",async()=>{
  for(let i=0;i<identity.length;i++){
    let queries=0;
    const scope=identity[i];
    const result=await readOfflineOrderCandidates({
      db:scopedDb(records,(q,opts)=>{
        queries++;
        assert.equal(q.empresaId,scope.empresaId);
        assert.equal(q.sedeId,scope.sedeId);
        assert.equal(q.actorId,scope.actorId);
        assert.deepEqual(q.eventId.$in,[ids[i]]);
        assert.equal(opts.limit,2);
      }),context:scope,eventIds:[ids[i]]
    });
    assert.equal(queries,1);
    assert.equal(result.orders.length,1);
    assert.equal(result.orders[0].eventId,ids[i]);
    assert.equal(result.totalCop,"3000");
  }
});
test("Capa 2 ofensiva: 12 intentos de leer pedido ajeno fallan cerrados",async()=>{
  let attempts=0;
  for(let i=0;i<identity.length;i++){
    for(let j=0;j<identity.length;j++){
      if(i===j)continue;
      await assert.rejects(readOfflineOrderCandidates({
        db:scopedDb(records),context:identity[i],eventIds:[ids[j]]
      }),{code:"OFFLINE_ORDERS_NOT_PENDING"});
      attempts++;
    }
  }
  assert.equal(attempts,12);
});
test("Capa 2 ofensiva: mezclar pedido propio con ajeno invalida todo el lote",async()=>{
  for(let i=0;i<identity.length;i++){
    const foreign=(i+1)%identity.length;
    await assert.rejects(readOfflineOrderCandidates({
      db:scopedDb(records),context:identity[i],eventIds:[ids[i],ids[foreign]]
    }),{code:"OFFLINE_ORDERS_NOT_PENDING"});
  }
});
test("Capa 2 ofensiva: respuesta Mongo contaminada de otro tenant no se publica",async()=>{
  for(let i=0;i<identity.length;i++){
    const foreign=records[(i+1)%identity.length];
    const db={collection(){return {find(){return {toArray:async()=>[foreign]};}};}};
    await assert.rejects(readOfflineOrderCandidates({
      db,context:identity[i],eventIds:[ids[i]]
    }),{code:"OFFLINE_ORDERS_NOT_PENDING"});
  }
});
