"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {versionCoincide}=require("../../core/auth/tokenVersion.guard");
test("Capa 2: valida sesiones con version exacta",()=>{
 assert.equal(versionCoincide(0,0),true);
 assert.equal(versionCoincide(7,7),true);
 assert.equal(versionCoincide(7,8),false);
 assert.equal(versionCoincide(undefined,undefined),true); // compatibilidad histórica
});
test("Capa 2: rechaza coercion numerica en versiones JWT",()=>{
 for(const invalid of [null,"", "0", "7", false, true, -1, 1.1, NaN, Infinity, {}, []]){
   assert.equal(versionCoincide(invalid,0),false);
   assert.equal(versionCoincide(0,invalid),false);
 }
});
