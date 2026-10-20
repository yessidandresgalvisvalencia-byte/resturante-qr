"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {assertOfflineStagingIndexes:check}=require("../../core/offline/offlineIndexesReadiness.service");
const specs={
 gruk_offline_ventas:["uniq_offline_sale_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
 gruk_offline_stock_movimientos:["uniq_offline_stock_tenant_batch_product",{empresaId:1,sedeId:1,batchId:1,productoId:1}],
 gruk_offline_caja_intenciones:["uniq_offline_cash_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
 gruk_ledger_movimientos:["uniq_offline_ledger_event_type_tenant",{empresaId:1,sedeId:1,eventId:1,tipo:1}]
};
function db(tamper){let reads=0;return {collection:name=>({indexes:async()=>{reads++;const [index,key]=specs[name];return [{name:index,key,unique:tamper!==name}];}}),reads:()=>reads};}
test("verifica cuatro indices sin crear nada",async()=>{const f=db();assert.deepEqual(await check(f),{ready:true,collections:4});assert.equal(f.reads(),4);});
test("indice no unico impide habilitar transaccion",async()=>{const f=db("gruk_offline_caja_intenciones");await assert.rejects(check(f),e=>e.code==="OFFLINE_INDEX_NOT_READY");});
test("ausencia de db falla cerrada",async()=>{await assert.rejects(check(null),e=>e.code==="OFFLINE_INDEX_DB_REQUIRED");});

test("Capa 2: readiness cierra ante índices ausentes o metadatos inválidos",async()=>{
 for(const name of Object.keys(specs)){
  for(const metadata of [undefined,null,{},[null],[undefined],[false],[{name:"other"},null]]){
   let accesses=0;
   const store={collection:collection=>{
    accesses++;
    const [index,key]=specs[collection];
    if(collection!==name)return {indexes:async()=>[{name:index,key,unique:true}]};
    return metadata===undefined?{}:{indexes:async()=>metadata};
   }};
   await assert.rejects(check(store),{code:"OFFLINE_INDEX_NOT_READY"});
   assert.ok(accesses>=1&&accesses<=4);
  }
 }
});
