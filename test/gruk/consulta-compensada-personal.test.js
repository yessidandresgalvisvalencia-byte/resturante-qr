"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {proyectar}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const usuarioId="usuario_1",original={usuarioId,movimientoId:"m1",tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const fuente={...original,_id:"m1",estado:"ACTIVA",fecha:"2026-10-25",cuentaId:"cuenta_1"};
const e=eventoCompensatorio({original,tipo:"CORRECCION",cambios:{montoMinor:22000,categoria:"Otros"},idempotencyKey:"k1",prevHash:"0".repeat(64),secuencia:1,fechaISO:"2026-10-25T15:00:00.000Z"});
const entrada={usuarioId,fuentes:[fuente],eventos:[e],cursor:{_id:usuarioId,secuencia:1,hashActual:e.hashActual}};
test("lectura reconstruye importe y categoría sin alterar fuente ni metadatos",()=>{
 const [r]=proyectar(entrada);assert.equal(r.montoMinor,22000);assert.equal(r.categoria,"Otros");
 assert.equal(r.cuentaId,"cuenta_1");assert.equal(fuente.montoMinor,25000);assert.equal(Object.isFrozen(r),true);
});
test("lectura detecta cadena truncada, cursor alterado, fuente alterada e identidad ajena",()=>{
 for(const x of [{eventos:[]},{cursor:null},{cursor:{...entrada.cursor,secuencia:2}},
  {fuentes:[{...fuente,montoMinor:999}]},{fuentes:[{...fuente,usuarioId:"otro"}]},
  {eventos:[{...e,usuarioId:"otro"}]}])assert.throws(()=>proyectar({...entrada,...x}),/INTEGRIDAD_LEDGER/);
});
test("anulación se proyecta conservando el documento original",()=>{
 const a=eventoCompensatorio({original:{...original,...e.cambios},tipo:"ANULACION",cambios:{},idempotencyKey:"k2",prevHash:e.hashActual,secuencia:2,fechaISO:e.fechaISO});
 const [r]=proyectar({...entrada,eventos:[e,a],cursor:{_id:usuarioId,secuencia:2,hashActual:a.hashActual}});
 assert.equal(r.estado,"ANULADA");assert.equal(fuente.estado,"ACTIVA");
});
test("lectura sin compensaciones mantiene estado histórico",()=>{
 assert.deepEqual(proyectar({...entrada,eventos:[],cursor:null}),[fuente]);
});
