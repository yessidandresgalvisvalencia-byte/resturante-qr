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
   return {authInfo:{authenticatedUserPrivileges:[
    permiso({db:"",collection:""},["find","insert","remove"])
   ]}};
  }
 });
 assert.equal(consultas,1);
 assert.equal(resultado.seguro,false);
 assert.deepEqual(resultado.acciones,["remove"]);
});
