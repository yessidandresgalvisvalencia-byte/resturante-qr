"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
function load(name,model){
 const file=path.join(__dirname,"../../core/auth",name);
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(file,"utf8"),{module,require:id=>id.startsWith("../../models/")?model:require("../../core/auth/tokenVersion.guard")},{filename:file});
 return module.exports;
}
test("unknown and inherited identity keys fail closed without database access",async()=>{
 const model={findById(){throw Error("unexpected read")},updateOne(){throw Error("unexpected write")}};
 const {validarVersionSesion}=load("sessionVersion.service.js",model);
 const {revocarIdentidad}=load("sessionRevocation.service.js",model);
 for(const identityType of ["constructor","__proto__","toString","UNKNOWN"]){
  assert.equal(await validarVersionSesion({identityType,sub:"u",tokenVersion:0}),false);
  assert.equal(await revocarIdentidad({identityType,usuarioId:"u"}),false);
 }
});
test("known identity rejects revoked version and accepts current version",async()=>{
 const model={findById:()=>({select:()=>({lean:async()=>({tokenVersion:2})})})};
 const {validarVersionSesion}=load("sessionVersion.service.js",model);
 assert.equal(await validarVersionSesion({identityType:"USUARIO",sub:"u",tokenVersion:1}),false);
 assert.equal(await validarVersionSesion({identityType:"USUARIO",sub:"u",tokenVersion:2}),true);
});
