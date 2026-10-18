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
