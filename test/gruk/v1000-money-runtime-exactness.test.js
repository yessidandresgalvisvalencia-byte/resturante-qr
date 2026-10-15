"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parseCop,centavos,sumarCop,restarCop}=require("../../core/finance/v1000/money");
test("V1000: centavos exactos en cadena Decimal y Dinero sin redondeo binario",()=>{
 const a=parseCop("0.10"),b=parseCop("0.20");
 assert.equal(centavos(sumarCop(a,b)),30);
 assert.equal(centavos(restarCop(parseCop("1.00"),parseCop("0.99"))),1);
 assert.equal(centavos(parseCop("123456789.99")),12345678999);
 assert.equal(centavos(parseCop("90071992547409.91")),Number.MAX_SAFE_INTEGER);
});
test("V1000: rechaza importes ambiguos, negativos, precision adicional y desbordamiento",()=>{
 for(const value of ["0","0.00","1.001","1e3","1,000.00","01.00","-1.00","90071992547409.92","Infinity",1.25,null]){
  assert.throws(()=>parseCop(value),/COP_FORMATO_INVALIDO|COP_FUERA_RANGO/);
 }
 assert.throws(()=>restarCop(parseCop("0.01"),parseCop("0.02")) ,/COP_SALDO_NEGATIVO/);
 assert.throws(()=>sumarCop(parseCop("90071992547409.91"),parseCop("0.01")),/COP_FUERA_RANGO/);
});
