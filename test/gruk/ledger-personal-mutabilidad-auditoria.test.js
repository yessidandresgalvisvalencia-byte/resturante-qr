"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const auditoria=require("../../scripts/gruk-personal-ledger-mutability-audit");
test("detecta alias, acceso inline y driver nativo de los cinco modelos protegidos",()=>{
 for(const modelo of ["TransaccionPersonal","EventoCompensatorioPersonal","decisionProofPersonal.model","eventoV81.model","vinculoHistoricoV81.model"]){
  for(const acceso of [
   `const Libro=require('../models/${modelo}'); Libro.updateMany({},{});`,
   `const Fuente=require('../models/${modelo}.js'); Fuente.collection.deleteOne({});`,
   `require('../models/${modelo}').bulkWrite([]);`
  ])assert.equal(auditoria.analizarAccesosModelos(acceso).length,1,acceso);
 }
 assert.equal(auditoria.analizarAccesosModelos(`db.collection('fin_transacciones_personales').replaceOne({},{});`).length,1);
 assert.deepEqual(auditoria.analizarAccesosModelos(`const Evento=require('../models/eventoProcesadoPersonal.model'); Evento.deleteOne({});`),[]);
 assert.deepEqual(auditoria.analizarAccesosModelos(`const Tx=require('../models/TransaccionPersonal'); Tx.create([]); Tx.collection.indexes();`),[]);
});
test("recorre archivos anidados fuera de los cinco archivos históricos",()=>{
 const os=require("node:os");
 const raiz=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-auditoria-"));
 try{
  const carpeta=path.join(raiz,"modules/finanzas-personales/nuevo/submodulo");fs.mkdirSync(carpeta,{recursive:true});
  fs.writeFileSync(path.join(carpeta,"escritura.js"),`const Libro=require('../../models/TransaccionPersonal');\nLibro.findByIdAndUpdate(id,{});`);
  const resultado=auditoria.auditarProyecto(raiz);
  assert.deepEqual(resultado.map(h=>({archivo:h.archivo,linea:h.linea})),[{archivo:"nuevo/submodulo/escritura.js",linea:2}]);
 }finally{fs.rmSync(raiz,{recursive:true,force:true});}
});
test("detector descubre mutaciones del original en corrección y anulación",()=>{
 const codigo='Object.assign(anterior,permitidos);await anterior.save({session});tx.estado="ANULADA";await tx.save({session});';
 assert.deepEqual(auditoria.analizarMutacionesLedger(codigo).map(x=>x.id),
 ["CORRECCION_ORIGINAL","SAVE_CORRECCION","ANULACION_ESTADO","SAVE_ANULACION"]);
 assert.deepEqual(auditoria.analizarMutacionesLedger("await Libro.insertMany([eventoReverso]);"),[]);
});
test("revisa scripts, rutas compartidas, controladores y entradas sin confundir modelos mutables",()=>{
 const raiz=fs.mkdtempSync(path.join(require("node:os").tmpdir(),"gruk-auditoria-externa-"));
 try{
  fs.mkdirSync(path.join(raiz,"modules/finanzas-personales"),{recursive:true});
  for(const carpeta of ["scripts","routes","controllers"])fs.mkdirSync(path.join(raiz,carpeta));
  for(const archivo of ["app.js","scripts/correccion.js","routes/compartida.js","controllers/accion.js"])
   fs.writeFileSync(path.join(raiz,archivo),`const Libro=require('../modules/finanzas-personales/models/TransaccionPersonal'); Libro.deleteMany({});`);
  fs.writeFileSync(path.join(raiz,"scripts/mutable.js"),`const Cuenta=require('../modules/finanzas-personales/models/cuentaFinanciera.model'); Cuenta.updateOne({},{});`);
  assert.deepEqual(auditoria.auditarProyecto(raiz).map(h=>h.archivo),["app.js","controllers/accion.js","routes/compartida.js","scripts/correccion.js"]);
 }finally{fs.rmSync(raiz,{recursive:true,force:true});}
});
test("auditoría actual revela la deuda técnica y no presenta ledger como inmutable",()=>{
 const src=fs.readFileSync(path.resolve(__dirname,"../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 const ids=auditoria.analizarMutacionesLedger(src).map(x=>x.id);
 assert.deepEqual(ids,[]);
 const pendientes=auditoria.auditarProyecto();
 assert.equal(pendientes.some(h=>h.archivo==="routes.js"),false);
 assert.equal(pendientes.some(h=>h.archivo==="services/patrimonioPersonal.service.js"),false);
 assert.equal(pendientes.some(h=>h.archivo==="services/compromisosCuotas.service.js"),false);
});
test("gate --enforce conserva el bloqueo aunque la búsqueda de patrones esté vacía",()=>{
 const file=path.resolve(__dirname,"../../scripts/gruk-personal-ledger-mutability-audit.js");
 const run=spawnSync(process.execPath,[file,"--enforce"],{encoding:"utf8"});
 assert.equal(run.status,1);
 assert.match(run.stderr,/NO certificado append-only/);
 assert.match(run.stderr,/issues\/407/);
 assert.match(run.stderr,/permisos MongoDB/);
});
