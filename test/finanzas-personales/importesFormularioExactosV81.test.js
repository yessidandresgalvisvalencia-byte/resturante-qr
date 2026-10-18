"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Importes COP de créditos, activos, inversiones y metas usan validación entera exacta",()=>{
 const a=src.indexOf("function pesosExactos("),z=src.indexOf("function body(",a);
 assert.ok(a>=0&&z>a);
 const ctx={$:id=>({value:ctx.value})};
 vm.runInNewContext(src.slice(a,z),ctx);
 for(const [value,valid] of [["1000",true],["0",false],["2.4",false],["-2",false],["9007199254740992",false],["1e3",false]]){
  ctx.value=value;
  if(valid)assert.equal(ctx.pesosExactos("campo"),1000);
  else assert.throws(()=>ctx.pesosExactos("campo"));
 }
 ctx.value="0";assert.equal(ctx.pesosExactos("campo",{permiteCero:true}),0);
 for(const field of ["cSaldo","cCuota","aValor","iCapital","iValor","gObjetivo","gAcumulado"])assert.ok(src.includes('pesosExactos("'+field+'"'));
});
