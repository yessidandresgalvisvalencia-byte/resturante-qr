"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {COLECCIONES,evaluarPrivilegiosLedgerPersonal:evaluar,auditarPrivilegiosLedgerPersonal:auditar}=require("../../modules/finanzas-personales/security/ledgerPersonalDbPrivileges.service");
const base="finanzas";
const permiso=(collection,actions,db=base)=>({resource:{db,collection},actions});
const estado=privilegios=>({ok:1,authInfo:{authenticatedUsers:[{user:"identidad_privada",db:"admin"}],authenticatedUserRoles:[{role:"rol_privado",db:"admin"}],authenticatedUserPrivileges:privilegios}});
const minimos=()=>COLECCIONES.map(c=>permiso(c,["find","insert","listIndexes"]));
test("cubre cinco colecciones de fuentes, compensaciones y evidencias",()=>{
 assert.equal(COLECCIONES.length,5);assert.ok(COLECCIONES.includes("fin_transacciones_personales"));
 assert.ok(COLECCIONES.includes("fin_eventos_compensatorios_personales_v1"));
 assert.equal(new Set(COLECCIONES).size,5);
});
test("permite inserciones protegidas y mutación de proyecciones en colecciones separadas",()=>{
 const r=evaluar(estado([...minimos(),permiso("fin_outbox_personal",["find","insert","update","remove"]),permiso("fin_cursor_compensaciones_personales_v1",["update","insert","find"])]),base);
 assert.equal(r.compatible,true);assert.equal(r.certificaInmutabilidad,false);
 assert.ok(r.colecciones.every(c=>c.compatible));
 assert.doesNotMatch(JSON.stringify(r),/identidad_privada|rol_privado/);
});
test("una colección sin insert no es compatible aunque no haya permisos peligrosos",()=>{
 for(const acciones of [[],["find"]]){
  const r=evaluar(estado([permiso("",acciones)]),base);
  assert.equal(r.compatible,false);assert.ok(r.colecciones.every(c=>c.faltantes.includes("insert")));
 }
 const sinIndices=evaluar(estado([permiso("",["find","insert"])]),base);
 assert.equal(sinIndices.compatible,false);assert.ok(sinIndices.colecciones.every(c=>c.faltantes.includes("listIndexes")));
});
test("detecta mutación en fuentes aunque DecisionProof esté restringido",()=>{
 const r=evaluar(estado([...minimos(),permiso(COLECCIONES[0],["update"])]),base);
 assert.equal(r.compatible,false);assert.deepEqual(r.colecciones[0].accionesNoPermitidas,["update"]);
});
test("detecta permisos heredados, globales, DDL y acciones desconocidas",()=>{
 for(const resource of [{db:base,collection:""},{db:"",collection:""},{db:"",collection:COLECCIONES[0]}]){
  const r=evaluar(estado([...minimos(),{resource,actions:["remove"]}]),base);
  assert.equal(r.compatible,false);assert.ok(r.colecciones.some(c=>c.accionesNoPermitidas.includes("remove")));
 }
 for(const accion of ["dropCollection","dropDatabase","renameCollectionSameDB","dropIndex","createIndex","bypassDocumentValidation","convertToCapped","futureUnknownAction"])
  assert.equal(evaluar(estado([...minimos(),permiso(COLECCIONES[0],[accion])]),base).compatible,false);
 assert.equal(evaluar(estado([...minimos(),{resource:{anyResource:true},actions:["find","insert"]}]),base).compatible,false);
});
test("permisos de administración de roles no quedan ocultos por apuntar a admin",()=>{
 for(const action of ["grantRole","createRole","updateUser","applyOps"]){
  const r=evaluar(estado([...minimos(),permiso("",[action],"admin")]),base);
  assert.equal(r.compatible,false);assert.ok(r.colecciones.every(c=>c.accionesNoPermitidas.includes(action)));
 }
 assert.equal(evaluar(estado([...minimos(),permiso("",["update"],"otra_base")]),base).compatible,true);
});
test("cluster no concede implícitamente lectura e inserción de documentos",()=>{
 assert.equal(evaluar(estado([{resource:{cluster:true},actions:["find","insert"]}]),base).compatible,false);
 assert.equal(evaluar(estado([...minimos(),{resource:{cluster:true},actions:["serverStatus"]}]),base).compatible,true);
});
test("falla cerrado ante identidades, respuestas y recursos malformados",()=>{
 for(const r of [null,{ok:0}, {...estado(minimos()),ok:undefined},
  {ok:1,authInfo:{...estado([]).authInfo,authenticatedUsers:[]}},
  {ok:1,authInfo:{...estado([]).authInfo,authenticatedUsers:[{user:"",db:"admin"}]}},
  {ok:1,authInfo:{...estado([]).authInfo,authenticatedUserRoles:[{}]}},
  estado([{resource:{},actions:["update"]}]),estado([{resource:{db:base,collection:"",anyResource:true},actions:["find"]}]),
  estado([{resource:{db:base,collection:""},actions:"update"}]),estado([{resource:{db:base,collection:""},actions:[42]}])])
  assert.equal(evaluar(r,base).compatible,false);
});
test("auditoría consulta solo connectionStatus y oculta fallos con datos privados",async()=>{
 const comandos=[];
 const r=await auditar({databaseName:base,command:async c=>{comandos.push(c);return estado(minimos());}});
 assert.equal(r.compatible,true);assert.deepEqual(comandos,[{connectionStatus:1,showPrivileges:true}]);
 const fallo=await auditar({databaseName:base,command:async()=>{throw Error("mongodb://usuario:secreto@servidor");}});
 assert.equal(fallo.compatible,false);assert.doesNotMatch(JSON.stringify(fallo),/usuario|secreto|servidor/);
});
