"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {claimsValidas}=require("../../core/auth/jwtClaims.guard");
const base={sub:"usuario-01",empresaId:"empresa-01",rol:"EMPLEADO"};
test("Capa 2: JWT claims de empresa válidos",()=>{
 assert.equal(claimsValidas(base),true);
 assert.equal(claimsValidas({...base,sedeId:"sede-01",tokenVersion:2}),true);
 assert.equal(claimsValidas({...base,identityType:"ADMIN",restaurantId:"rest-1"}),true);
});
test("Capa 2: rechazar valores JWT falsificados y no strings",()=>{
 for(const key of ["sub","empresaId","rol"]){
  for(const value of [null,undefined,"",{},[],1,true," "]){
   assert.equal(claimsValidas({...base,[key]:value}),false,key+":"+String(value));
  }
 }
 for(const key of ["sedeId","restaurantId","identityType"]){
  for(const value of [{},[],false,10," ",""]){
   assert.equal(claimsValidas({...base,[key]:value}),false,key);
  }
 }
 for(const value of [null,"0","",false,-1,1.2,{},[],Number.MAX_SAFE_INTEGER+1]){
  assert.equal(claimsValidas({...base,tokenVersion:value}),false);
 }
 assert.equal(claimsValidas({...base,rol:"DUEÑO"}),true);
 assert.equal(claimsValidas({...base,rol:"ADMIN_SEDE"}),true);
 assert.equal(claimsValidas({...base,rol:"ADMIN"}),false);
});
