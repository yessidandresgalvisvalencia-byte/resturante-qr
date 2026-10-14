"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Saldo=require("../../models/SaldoLedgerV1000");
test("Cabecera V1000 rechaza saldo decimal, negativo e inseguro",()=>{
 for(const patch of [{saldoCentavos:1.1},{saldoCentavos:-1},{saldoCentavos:Number.MAX_SAFE_INTEGER+1},{secuencia:-1},{secuencia:0.5},{hashUltimo:"hash-modificado"}]){
  const row=new Saldo({empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW",...patch});
  assert.ok(row.validateSync(),JSON.stringify(patch));
 }
 const ok=new Saldo({empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW"});
 assert.equal(ok.validateSync(),undefined);
});
