"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const jwt=require("jsonwebtoken");
const {autenticarSocket}=require("../../core/auth/socketHandshake.service");
const secret="only-for-tests-socket-jwt-secret";
const claims={
 sub:"507f1f77bcf86cd799439011",
 empresaId:"507f1f77bcf86cd799439012",
 restaurantId:"restaurante-demo",sedeId:null,
 rol:"DUEÑO",identityType:"USUARIO",tokenVersion:0
};
function token(changes={},options={}){
 return jwt.sign({...claims,...changes},secret,{algorithm:"HS256",expiresIn:"5m",...options});
}
test("Capa 2 Socket.IO rechaza JWT sin identidad, roles falsificados y sesión revocada",async()=>{
 let checks=0;
 const verificarSesion=async()=>{checks++;return true;};
 const valido=await autenticarSocket({token:"Bearer "+token(),secret,verificarSesion});
 assert.equal(valido.empresaId,claims.empresaId);
 assert.equal(valido.identityType,"USUARIO");
 assert.equal(Object.isFrozen(valido),true);
 assert.equal(checks,1);
 for(const override of [
  {identityType:undefined},{empresaId:undefined},{sub:undefined},
  {rol:"SUPERADMIN"},{tokenVersion:-1},{identityType:""},
  {empresaId:{ $ne:null }}
 ]){
  assert.equal(await autenticarSocket({token:token(override),secret,verificarSesion}),null,
    JSON.stringify(override));
 }
 assert.equal(await autenticarSocket({token:token(),secret,
  verificarSesion:async()=>false}),null);
 assert.equal(await autenticarSocket({token:token(),secret:"wrong-secret",verificarSesion}),null);
 assert.equal(await autenticarSocket({token:"Bearer invalid",secret,verificarSesion}),null);
 assert.equal(await autenticarSocket({token:"x".repeat(8200),secret,verificarSesion}),null);
 assert.equal(checks,1,"JWT inválidos no deben consultar la base de sesiones");
});
test("Capa 2 Socket.IO admite token directo y rechaza expirado",async()=>{
 assert.equal((await autenticarSocket({token:token(),secret,verificarSesion:async()=>true})).rol,"DUEÑO");
 const expirado=jwt.sign({...claims,exp:Math.floor(Date.now()/1000)-5},secret,{algorithm:"HS256"});
 assert.equal(await autenticarSocket({token:expirado,secret,verificarSesion:async()=>true}),null);
});
