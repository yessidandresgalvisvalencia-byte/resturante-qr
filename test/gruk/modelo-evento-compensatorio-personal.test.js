"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Model=require("../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const original={usuarioId:"507f1f77bcf86cd799439011",movimientoId:"507f1f77bcf86cd799439012",
 tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const evt=()=>eventoCompensatorio({original,tipo:"CORRECCION",cambios:{montoMinor:22000},
 prevHash:"0".repeat(64),secuencia:1,idempotencyKey:"ajuste_001",fechaISO:"2026-10-20T15:00:00.000Z"});
test("modelo representa el mismo payload firmado con hash SHA256",async()=>{
 const x=evt();
 const doc=new Model(x);
 await doc.validate();
 assert.equal(doc.hashActual,x.hashActual);
 assert.equal(doc.deltaCajaMinor,"3000");
 assert.equal(doc.usuarioId,original.usuarioId);
 assert.equal(doc.original.montoMinor,25000);
 assert.equal(Model.collection.name,"fin_eventos_compensatorios_personales_v1");
 assert.equal(Object.hasOwn(doc.toObject().original,"impactoCaja"),false);
});
test("modelo V2 conserva el efecto de caja firmado, incluido false",async()=>{
 for(const impactoCaja of [true,false]){
  const e=eventoCompensatorio({...evt(),original:{...original,tipo:"PAGO_DEUDA",impactoCaja},tipo:"ANULACION",cambios:{}});
  const doc=new Model(e);await doc.validate();
  assert.equal(doc.toObject().original.impactoCaja,impactoCaja);
  assert.equal(doc.version,2);
 }
 await assert.rejects(new Model({...evt(),version:2,original:{...original,tipo:"PAGO_DEUDA"}}).validate());
});
test("índices únicos garantizan intención de idempotencia y orden por usuario",()=>{
 const indexes=Model.schema.indexes();
 for(const [name,keys] of [
  ["fp_compensacion_idempotencia_usuario_v1",{usuarioId:1,idempotencyKey:1}],
  ["fp_compensacion_orden_usuario_v1",{usuarioId:1,secuencia:1}]
 ]){
  const matches=indexes.filter(([k,opts])=>opts.name===name);
  assert.equal(matches.length,1);
  assert.deepEqual(matches[0][0],keys);
  assert.equal(matches[0][1].unique,true);
 }
});
test("rechaza montos no enteros, hash inválido y campos inesperados",async()=>{
 await assert.rejects(new Model({...evt(),original:{...original,montoMinor:0.1}}).validate());
 await assert.rejects(new Model({...evt(),hashActual:"no-hash"}).validate());
 assert.throws(()=>new Model({...evt(),claveSecreta:"no-permitida"}),/not in schema/);
});
test("modelo declara hooks para bloquear UPDATE DELETE y SAVE de originales",()=>{
 const hooks=Model.schema.s.hooks;
 for(const action of ["save","updateOne","updateMany","findOneAndUpdate","replaceOne",
  "deleteOne","deleteMany","findOneAndDelete"]){
  assert.ok(hooks._pres.get(action)?.some(h=>h.fn.toString().includes("prohibirMutacion")),
    "falta bloqueo de "+action);
 }
});
