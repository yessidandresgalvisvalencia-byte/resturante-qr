"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {calculateMovement}=require("../../core/ledger/copAmounts");
test("COP: integer centavos exact with large amounts",()=>{
 const x=calculateMovement({beforeCentavos:"999999999999999999",amountCentavos:"1",tipo:"CREDITO"});
 assert.equal(x.afterCentavos,"1000000000000000000");
});
test("COP: debit and credit reversible exactly",()=>{
 const a=calculateMovement({beforeCentavos:"12001",amountCentavos:"1",tipo:"DEBITO"});
 const b=calculateMovement({beforeCentavos:a.afterCentavos,amountCentavos:"1",tipo:"CREDITO"});
 assert.equal(b.afterCentavos,"12001");
});
test("COP: rejects float, decimal input, negative amount, and ambiguous zeros",()=>{
 for(const bad of [0.1,"0.1","-1","01","0","1e3",1])assert.throws(()=>calculateMovement({beforeCentavos:"0",amountCentavos:bad,tipo:"CREDITO"}));
});
test("COP: cannot silently change currency or type",()=>{
 assert.throws(()=>calculateMovement({beforeCentavos:"0",amountCentavos:"1",tipo:"AJUSTE"}),/LEDGER_INVALID_TYPE/);
});
