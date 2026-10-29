"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {claimsValidas}=require("../../core/auth/jwtClaims.guard");
const base={sub:"usuario-01",empresaId:"empresa-01",sedeId:"sede-01",rol:"EMPLEADO"};
test("Capa 2: claims válidos conservan alcance por empresa y sede",()=>{
 assert.equal(claimsValidas(base),true);
 assert.equal(claimsValidas({...base,empresaId:"507f1f77bcf86cd799439011"}),true);
 assert.equal(claimsValidas({...base,sedeId:null}),true);
});
test("Capa 2: identificadores peligrosos o ambiguos se rechazan",()=>{
 const invalid=[" empresa-01","empresa-01 ","empresa.01","$ne","empresa/01",
  "empresa\n01","empresa\u0000A","área","a".repeat(81)];
 for(const field of ["empresaId","sedeId"]){
  for(const value of invalid){
   assert.equal(claimsValidas({...base,[field]:value}),false,field+":"+JSON.stringify(value));
  }
 }
});
