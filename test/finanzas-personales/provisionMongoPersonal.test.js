"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {provisionarMongoPersonal,modelosPersonales}=require("../../modules/finanzas-personales/security/provisionMongoPersonal.service");
const modelo=(nombre,indices=[])=>({collection:{collectionName:nombre},schema:{indexes:()=>indices}});
test("provisión solo crea colecciones e índices y admite repetición sin borrar datos",async()=>{
 const colecciones=new Set(),indices=new Set(),operaciones=[];
 const db={listCollections:()=>({toArray:async()=>[...colecciones].map(name=>({name,type:"collection"}))}),
  createCollection:async nombre=>{operaciones.push(["crear",nombre]);colecciones.add(nombre);},
  collection:nombre=>({createIndex:async(campos,opciones)=>{operaciones.push(["indice",nombre]);indices.add(JSON.stringify({nombre,campos,opciones}));}})};
 const modelos=[modelo("fuentes",[[{usuarioId:1,clave:1},{unique:true}]]),modelo("cursor")];
 const primero=await provisionarMongoPersonal(db,{modelos});
 const segundo=await provisionarMongoPersonal(db,{modelos});
 assert.equal(primero.coleccionesCreadas,2);assert.equal(segundo.coleccionesCreadas,0);
 assert.equal(indices.size,1);assert.equal(segundo.indicesSolicitados,1);
 assert.ok(operaciones.every(([tipo])=>["crear","indice"].includes(tipo)));
});
test("conflictos de índice y errores de acceso se propagan sin retirarlos",async()=>{
 const fallo=Object.assign(Error("Opciones incompatibles"),{code:85});
 const vacias=()=>({toArray:async()=>[]});
 await assert.rejects(provisionarMongoPersonal({listCollections:vacias,createCollection:async()=>{},collection:()=>({createIndex:async()=>{throw fallo;}})},
  {modelos:[modelo("fuentes",[[{clave:1},{unique:true}]])]}),e=>e===fallo);
 await assert.rejects(provisionarMongoPersonal({listCollections:vacias,createCollection:async()=>{throw Object.assign(Error("denegado"),{code:13});},collection:()=>({})},
  {modelos:[modelo("fuentes")]}),e=>e.code===13);
});
test("rechaza manifiestos vacíos o duplicados antes de iniciar provisión",async()=>{
 let escrituras=0;const db={listCollections:()=>({toArray:async()=>[]}),createCollection:async()=>{escrituras++;},collection:()=>({})};
 for(const modelos of [[],[modelo("fuentes"),modelo("fuentes")],[{}]])await assert.rejects(provisionarMongoPersonal(db,{modelos}));
 assert.equal(escrituras,0);
 const modelos=modelosPersonales();assert.ok(modelos.length>=44);
 assert.equal(new Set(modelos.map(m=>m.collection.collectionName)).size,modelos.length);
});
test("una vista con el nombre de un modelo impide provisión antes de crear índices",async()=>{
 let escrituras=0;
 const db={listCollections:()=>({toArray:async()=>[{name:"fuentes",type:"view"}]}),createCollection:async()=>{escrituras++;},collection:()=>({createIndex:async()=>{escrituras++;}})};
 await assert.rejects(provisionarMongoPersonal(db,{modelos:[modelo("fuentes")]}),/tipo incompatible/);assert.equal(escrituras,0);
});
test("CLI exige acción explícita y credencial administrativa independiente",async()=>{
 const {main}=require("../../scripts/provision-personal-mongo");
 await assert.rejects(main([]),/--apply/);
 const anterior=process.env.PERSONAL_MONGO_PROVISION_URI;
 try{delete process.env.PERSONAL_MONGO_PROVISION_URI;await assert.rejects(main(["--apply"]),/PROVISION_URI requerida/);}
 finally{if(anterior!==undefined)process.env.PERSONAL_MONGO_PROVISION_URI=anterior;}
});
