"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {inspect}=require("../../scripts/gruk-offline-index-audit");
const definitions={
 gruk_offline_ventas:["uniq_offline_sale_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
 gruk_offline_stock_movimientos:["uniq_offline_stock_tenant_batch_product",{empresaId:1,sedeId:1,batchId:1,productoId:1}],
 gruk_offline_caja_intenciones:["uniq_offline_cash_tenant_event",{empresaId:1,sedeId:1,eventId:1}],
 gruk_ledger_movimientos:["uniq_offline_ledger_event_type_tenant",{empresaId:1,sedeId:1,eventId:1,tipo:1}]
};
function db({duplicate=false,indexMissing=false}={}){
 let calls=0;return {collection(name){assert.ok(definitions[name]);return {
  aggregate:()=>({toArray:async()=>duplicate&&name==="gruk_offline_ventas"?[{duplicateGroups:1}]:[]}),
  indexes:async()=>{calls++;return indexMissing&&name==="gruk_offline_caja_intenciones"?[]:
   [{name:definitions[name][0],key:definitions[name][1],unique:true}];}
 };},count:()=>calls};
}
test("diagnóstico read-only reporta listo con índices y sin duplicados",async()=>{
 const f=db(),r=await inspect(f);assert.equal(r.ready,true);assert.equal(r.indexesReady,true);
 assert.equal(r.duplicates.safe,true);assert.equal(f.count(),4);
});
test("duplicados impiden estado listo aunque índices estén presentes",async()=>{
 const r=await inspect(db({duplicate:true}));assert.equal(r.ready,false);assert.equal(r.duplicates.safe,false);
});
test("índice ausente impide estado listo sin crear índice",async()=>{
 const r=await inspect(db({indexMissing:true}));assert.equal(r.ready,false);assert.equal(r.indexesReady,false);
});
