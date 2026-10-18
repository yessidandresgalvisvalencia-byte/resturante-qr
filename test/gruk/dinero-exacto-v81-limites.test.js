"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parsearCopACentavos,sumarCentavos}=require("../../modules/finanzas-personales/services/dineroExactoV81.service");

test("V81 convierte centavos COP exactamente sin float",()=>{
 assert.equal(parsearCopACentavos("0.1")+parsearCopACentavos("0.2"),30n);
 assert.equal(parsearCopACentavos("25000.30"),2500030n);
 assert.equal(sumarCentavos([1n,2n,3n]),6n);
});
test("V81 admite hasta quince digitos enteros en COP",()=>{
 assert.equal(parsearCopACentavos("999999999999999.99"),99999999999999999n);
 assert.equal(parsearCopACentavos("0"),0n);
});
test("V81 rechaza numeros enormes, notacion cientifica, negativos y floats",()=>{
 const casos=["1".repeat(16),"9".repeat(100000),"1e8","-100","01","1.234","1,000",1.2,Infinity,NaN,""];
 for(const valor of casos)assert.throws(()=>parsearCopACentavos(valor),TypeError);
});
