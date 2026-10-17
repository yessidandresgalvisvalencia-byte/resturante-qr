"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {copToCentavos,buildVentaLedgerCommand}=require("../../core/ledger/ventaLedger.adapter");
const id="507f1f77bcf86cd799439011";
test("COP exact cents without float or rounding",()=>{
 assert.equal(copToCentavos("52000"),"5200000");
 assert.equal(copToCentavos("0.01"),"1");
 assert.equal(copToCentavos("280000.04"),"28000004");
});
test("invalid amounts fail closed",()=>{
 for(const n of [52000,0,NaN,"0","0.00","1.001","1e6","-1","01.00","1,50",null])
  assert.throws(()=>copToCentavos(n));
});
test("tenant and actor required; deterministic event id",()=>{
 const command=buildVentaLedgerCommand({ventaId:id,empresaId:id,sedeId:id,actorId:id,amountCOP:"12.30",ip:"127.0.0.1"});
 assert.equal(command.amountCentavos,"1230");
 assert.equal(command.eventId,"venta_"+id);
 assert.equal(command.tipo,"CREDITO");
 assert.equal(command.cuentaId,"VENTAS");
 assert.ok(Object.isFrozen(command));
 assert.throws(()=>buildVentaLedgerCommand({ventaId:id,empresaId:id,sedeId:null,actorId:id,amountCOP:"12.30",ip:"127.0.0.1"}));
});
