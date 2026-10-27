"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const auditoria=require("../../scripts/gruk-personal-ledger-mutability-audit");
test("detector descubre mutaciones del original en corrección y anulación",()=>{
 const codigo='Object.assign(anterior,permitidos);await anterior.save({session});tx.estado="ANULADA";await tx.save({session});';
 assert.deepEqual(auditoria.analizarMutacionesLedger(codigo).map(x=>x.id),
 ["CORRECCION_ORIGINAL","SAVE_CORRECCION","ANULACION_ESTADO","SAVE_ANULACION"]);
 assert.deepEqual(auditoria.analizarMutacionesLedger("await Libro.insertMany([eventoReverso]);"),[]);
});
test("auditoría actual revela la deuda técnica y no presenta ledger como inmutable",()=>{
 const src=fs.readFileSync(path.resolve(__dirname,"../../modules/finanzas-personales/services/flujoCajaPersonal.service.js"),"utf8");
 const ids=auditoria.analizarMutacionesLedger(src).map(x=>x.id);
 assert.deepEqual(ids,[]);
 const pendientes=auditoria.auditarProyecto();
 assert.ok(pendientes.some(h=>h.archivo==="routes.js"));
 assert.ok(pendientes.some(h=>h.archivo==="services/patrimonioPersonal.service.js"));
 assert.ok(pendientes.some(h=>h.archivo==="services/compromisosCuotas.service.js"));
});
test("gate --enforce falla cerradamente mientras los originales sean editables",()=>{
 const file=path.resolve(__dirname,"../../scripts/gruk-personal-ledger-mutability-audit.js");
 const run=spawnSync(process.execPath,[file,"--enforce"],{encoding:"utf8"});
 assert.equal(run.status,1);
 assert.match(run.stderr,/NO certificado append-only/);
 assert.match(run.stderr,/issues\/407/);
});
