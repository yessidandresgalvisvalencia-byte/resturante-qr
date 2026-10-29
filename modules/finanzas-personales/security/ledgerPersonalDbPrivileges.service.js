"use strict";
// Política conservadora de la conexión de aplicación. No certifica la configuración
// del servidor, la custodia de anclas ni la ausencia de otras credenciales privilegiadas.
const COLECCIONES=Object.freeze([
 require("../models/TransaccionPersonal").collection.collectionName,
 require("../models/EventoCompensatorioPersonal").collection.collectionName,
 require("../models/decisionProofPersonal.model").collection.collectionName,
 require("../models/eventoV81.model").collection.collectionName,
 require("../models/vinculoHistoricoV81.model").collection.collectionName
]);
const LECTURA=new Set(["find","listIndexes","listCollections","collStats","dbStats","indexStats","killCursors","planCacheRead"]);
const CLUSTER_LECTURA=new Set(["serverStatus","hostInfo","getCmdLineOpts","getParameter","listDatabases","connPoolStats","getLog","inprog"]);
const ESCALADA=new Set(["anyAction","grantRole","revokeRole","createRole","updateRole","dropRole","createUser","updateUser","dropUser",
 "grantPrivilegesToRole","revokePrivilegesFromRole","setAuthenticationRestriction","impersonate","applyOps","internal"]);
const objeto=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const texto=v=>typeof v==="string"&&v.trim().length>0;
function recursoValido(r){
 if(!objeto(r))return false;
 const keys=Object.keys(r);
 return keys.length===1&&(r.anyResource===true||r.cluster===true)||
  keys.length===2&&Object.hasOwn(r,"db")&&Object.hasOwn(r,"collection")&&typeof r.db==="string"&&typeof r.collection==="string";
}
function aplica(r,base,coleccion){
 return r.anyResource===true||typeof r.db==="string"&&(r.db===""||r.db===base)&&(r.collection===""||r.collection===coleccion);
}
function evaluarPrivilegiosLedgerPersonal(estado,base){
 if(!texto(base))throw new TypeError("Base de datos obligatoria");
 const respuesta={version:1,base,alcance:"PRIVILEGIOS_EFECTIVOS",compatible:false,certificaInmutabilidad:false,colecciones:[]};
 const falla=codigo=>({...respuesta,codigo});
 if(estado?.ok!==1||!objeto(estado.authInfo))return falla("RESPUESTA_NO_VERIFICABLE");
 const info=estado.authInfo;
 if(!Array.isArray(info.authenticatedUsers)||!info.authenticatedUsers.length)return falla("SIN_AUTENTICACION_VERIFICABLE");
 if(!info.authenticatedUsers.every(u=>objeto(u)&&texto(u.user)&&texto(u.db)))return falla("IDENTIDAD_MALFORMADA");
 if(!Array.isArray(info.authenticatedUserRoles)||!info.authenticatedUserRoles.length||
  !info.authenticatedUserRoles.every(r=>objeto(r)&&texto(r.role)&&texto(r.db)))return falla("ROLES_NO_VERIFICABLES");
 const privilegios=info.authenticatedUserPrivileges;
 if(!Array.isArray(privilegios))return falla("PRIVILEGIOS_NO_VERIFICABLES");
 if(!privilegios.every(p=>objeto(p)&&recursoValido(p.resource)&&Array.isArray(p.actions)&&p.actions.every(texto)))
  return falla("PRIVILEGIOS_MALFORMADOS");
 const globales=new Set();
 for(const p of privilegios){
  if(p.resource.anyResource===true)globales.add("anyResource");
  for(const a of p.actions){
   if(ESCALADA.has(a))globales.add(a);
   if(p.resource.cluster===true&&!CLUSTER_LECTURA.has(a))globales.add(a);
  }
 }
 const colecciones=COLECCIONES.map(coleccion=>{
  const acciones=new Set(globales),concedidas=new Set();
  for(const p of privilegios){
   if(!aplica(p.resource,base,coleccion))continue;
   for(const a of p.actions){concedidas.add(a);if(a!=="insert"&&!LECTURA.has(a))acciones.add(a);}
  }
  const faltantes=["find","insert","listIndexes"].filter(a=>!concedidas.has(a));
  return {coleccion,compatible:acciones.size===0&&faltantes.length===0,accionesNoPermitidas:[...acciones].sort(),faltantes};
 });
 const compatible=colecciones.every(c=>c.compatible);
 return {...respuesta,compatible,codigo:compatible?"POLITICA_PRIVILEGIOS_COMPATIBLE":"POLITICA_PRIVILEGIOS_NO_COMPATIBLE",colecciones};
}
async function auditarPrivilegiosLedgerPersonal(db){
 if(!db||!texto(db.databaseName)||typeof db.command!=="function")throw new TypeError("Conexión MongoDB inválida");
 let estado;
 try{estado=await db.command({connectionStatus:1,showPrivileges:true});}
 catch{return {version:1,base:db.databaseName,alcance:"PRIVILEGIOS_EFECTIVOS",compatible:false,certificaInmutabilidad:false,codigo:"CONSULTA_PRIVILEGIOS_NO_VERIFICABLE",colecciones:[]};}
 return evaluarPrivilegiosLedgerPersonal(estado,db.databaseName);
}
module.exports={COLECCIONES,evaluarPrivilegiosLedgerPersonal,auditarPrivilegiosLedgerPersonal};
