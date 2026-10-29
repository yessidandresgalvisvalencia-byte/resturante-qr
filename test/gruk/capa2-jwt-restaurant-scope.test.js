"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {claimsValidas}=require("../../core/auth/jwtClaims.guard");
const base={sub:"user-1",empresaId:"empresa-1",sedeId:"sede-1",rol:"EMPLEADO"};
test("Capa 2: restaurantId válido permite tokens históricos",()=>{
 for(const restaurantId of [undefined,null,"yessid","507f1f77bcf86cd799439011","rest_01"]){
  assert.equal(claimsValidas({...base,restaurantId}),true,String(restaurantId));
 }
});
test("Capa 2: restaurantId no puede introducir operadores ni rutas de otra colección",()=>{
 for(const restaurantId of ["$ne","rest.1","rest/1"," rest1","rest1 ","\u0000rest","rest\n1","área","x".repeat(81)]){
  assert.equal(claimsValidas({...base,restaurantId}),false,JSON.stringify(restaurantId));
 }
});
