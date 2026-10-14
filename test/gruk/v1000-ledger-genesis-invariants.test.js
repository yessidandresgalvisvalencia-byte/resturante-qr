"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Saldo=require("../../models/SaldoLedgerV1000");
const ids={empresaId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",sedeId:"01ARZ3NDEKTSV4RRFFQ69G5FAW"};
test("V1000 rechaza genesis adulterado con dinero o hash ajeno",async()=>{
 for(const patch of [{secuencia:0,saldoCentavos:1},{secuencia:0,hashUltimo:"a".repeat(64)}]){
  await assert.rejects(new Saldo({...ids,...patch}).validate(),/LEDGER_GENESIS_INCONSISTENTE/);
 }
});
test("V1000 rechaza cabecera avanzada con hash de genesis",async()=>{
 await assert.rejects(new Saldo({...ids,secuencia:1,saldoCentavos:1}).validate(),/LEDGER_CABECERA_SIN_ASIENTOS/);
});
test("V1000 admite genesis vacío y cabecera con hash de asiento",async()=>{
 await new Saldo(ids).validate();
 await new Saldo({...ids,secuencia:1,saldoCentavos:1,hashUltimo:"a".repeat(64)}).validate();
});
