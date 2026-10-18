"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
 aplicaAlHistorial,
 detectarPrivilegiosPeligrosos,
 auditarPrivilegiosHistorial
} = require("../../modules/finanzas-personales/security/decisionProofDbPrivileges.service");

const db="finanzas", collection="decisionproofpersonals";
const permiso=(resource,actions)=>({resource,actions});

test("detecta UPDATE y REMOVE sobre la colección del historial",()=>{
 const peligrosos=detectarPrivilegiosPeligrosos([
  permiso({db,collection},["find","insert","update","remove"])
 ],db,collection);
 assert.deepEqual(peligrosos,["remove","update"]);
});

test("detecta permisos heredados en toda la base o todas las bases",()=>{
 assert.deepEqual(detectarPrivilegiosPeligrosos([
  permiso({db,collection:""},["update"]),
  permiso({db:"",collection:""},["dropCollection"])
 ],db,collection),["dropCollection","update"]);
 assert.equal(aplicaAlHistorial({anyResource:true},db,collection),true);
});

test("ignora privilegios sobre otras colecciones y bases",()=>{
 assert.deepEqual(detectarPrivilegiosPeligrosos([
  permiso({db,collection:"fin_outbox_personal"},["update","remove"]),
  permiso({db:"otra_base",collection:""},["update"]),
  permiso({cluster:true},["killop"]),
  permiso({db,collection},["find","insert"])
 ],db,collection),[]);
});

test("falla cerrado cuando el servidor no entrega privilegios",async()=>{
 const respuesta=await auditarPrivilegiosHistorial({
  databaseName:db,
  command:async()=>({authInfo:{authenticatedUserPrivileges:null}})
 });
 assert.equal(respuesta.seguro,false);
 assert.equal(respuesta.codigo,"PRIVILEGIOS_NO_VERIFICABLES");
});

test("audita permisos efectivos sin realizar escrituras",async()=>{
 let consultas=0;
 const resultado=await auditarPrivilegiosHistorial({
  databaseName:db,
  command:async(comando)=>{
   consultas++;
   assert.deepEqual(comando,{connectionStatus:1,showPrivileges:true});
   return {authInfo:{authenticatedUsers:[{user:"personal_writer",db:"admin"}],authenticatedUserRoles:[{role:"customPersonal",db:"admin"}],authenticatedUserPrivileges:[
    permiso({db:"",collection:""},["find","insert","remove"])
   ]}};
  }
 });
 assert.equal(consultas,1);
 assert.equal(resultado.seguro,false);
 assert.deepEqual(resultado.acciones,["remove"]);
});

test("falla cerrado si MongoDB responde sin usuario autenticado",async()=>{
 const resultado=await auditarPrivilegiosHistorial({
  databaseName:db,
  command:async()=>({authInfo:{
   authenticatedUsers:[],authenticatedUserRoles:[],
   authenticatedUserPrivileges:[]
  }})
 });
 assert.equal(resultado.seguro,false);
 assert.equal(resultado.codigo,"SIN_AUTENTICACION_VERIFICABLE");
});

test("falla cerrado si no puede verificar los roles autenticados",async()=>{
 const resultado=await auditarPrivilegiosHistorial({
  databaseName:db,
  command:async()=>({authInfo:{
   authenticatedUsers:[{user:"personal_writer",db:"admin"}],
   authenticatedUserRoles:[],
   authenticatedUserPrivileges:[]
  }})
 });
 assert.equal(resultado.seguro,false);
 assert.equal(resultado.codigo,"ROLES_NO_VERIFICABLES");
});

test("detecta riesgo de suprimir índices de integridad",()=>{
 assert.deepEqual(detectarPrivilegiosPeligrosos([
  permiso({db,collection},["dropIndex","renameCollectionSameDB"])
 ],db,collection),["dropIndex","renameCollectionSameDB"]);
});

test("acepta solo lectura e inserción con identidad y roles verificados",async()=>{
 const resultado=await auditarPrivilegiosHistorial({
  databaseName:db,
  command:async()=>({authInfo:{
   authenticatedUsers:[{user:"personal_writer",db:"admin"}],
   authenticatedUserRoles:[{role:"personal_writer",db:"admin"}],
   authenticatedUserPrivileges:[permiso({db,collection},["find","insert"])]
  }})
 });
 assert.equal(resultado.seguro,true);
 assert.equal(resultado.codigo,"SIN_PRIVILEGIOS_PELIGROSOS_DETECTADOS");
});

test("falla cerrado ante privilegios vacíos de estructura inválida",async()=>{
 const auth={authenticatedUsers:[{user:"personal",db:"admin"}],authenticatedUserRoles:[{role:"personal",db:"admin"}]};
 for(const invalido of [
  {resource:{db,collection},actions:"update"},
  {resource:{},actions:["update"]},
  {resource:null,actions:["remove"]},
  {resource:{db,collection},actions:[123]}
 ]){
  const resultado=await auditarPrivilegiosHistorial({
   databaseName:db,
   command:async()=>({authInfo:{...auth,authenticatedUserPrivileges:[invalido]}})
  });
  assert.equal(resultado.seguro,false);
  assert.equal(resultado.codigo,"PRIVILEGIOS_MALFORMADOS");
 }
});

test("no ignora acciones administrativas peligrosas a nivel clúster",()=>{
 assert.deepEqual(detectarPrivilegiosPeligrosos([
  permiso({cluster:true},["anyAction","killop"]),
  permiso({cluster:true},["grantRole"])
 ],db,collection),["anyAction","grantRole"]);
 assert.equal(aplicaAlHistorial({cluster:true},db,collection),true);
});
