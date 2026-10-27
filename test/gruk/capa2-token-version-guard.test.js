"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {versionCoincide,payloadSesionValido}=require("../../core/auth/tokenVersion.guard");
test("Capa 2: valida sesiones con version exacta",()=>{
 assert.equal(versionCoincide(0,0),true);
 assert.equal(versionCoincide(7,7),true);
 assert.equal(versionCoincide(7,8),false);
 assert.equal(versionCoincide(undefined,undefined),true);
});
test("Capa 2: rechaza coercion numerica en versiones JWT",()=>{
 for(const invalid of [null,"","0","7",false,true,-1,1.1,NaN,Infinity,{},[]]){
  assert.equal(versionCoincide(invalid,0),false);
  assert.equal(versionCoincide(0,invalid),false);
 }
 assert.equal(versionCoincide(Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER),true);
 assert.equal(versionCoincide(Number.MAX_SAFE_INTEGER+1,Number.MAX_SAFE_INTEGER+1),false);
});
test("Capa 2: rechaza identidades incompletas sin consultar DB",()=>{
 for(const invalid of [null,undefined,"",0,[],{identityType:"ADMIN"},{identityType:"ADMIN",sub:" "},{identityType:[]},{identityType:1}]){
  assert.equal(payloadSesionValido(invalid),false);
 }
 assert.equal(payloadSesionValido({identityType:"ADMIN",sub:"user-1"}),true);
 assert.equal(payloadSesionValido({}),true); // compatibilidad explícita con tokens históricos
});
