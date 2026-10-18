"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {validarSolicitudV81}=require("../../modules/finanzas-personales/services/registroMovimientoV81.handler");

const base={
 id:"movimiento_20260101",
 tipo:"GASTO",
 montoCop:"25000.30",
 fechaContable:"2026-01-01",
 timestamp:"2026-01-01T10:00:00-05:00"
};
test("V81 acepta zona explicita y mantiene monto exacto",()=>{
 const x=validarSolicitudV81(base);
 assert.equal(x.montoCentavos,2500030n);
 assert.equal(x.timestamp,base.timestamp);
});
test("V81 rechaza timestamp sin zona, fecha ambigua y huso no valido",()=>{
 for(const timestamp of [
  "2026-01-01T10:00:00",
  "2026-01-01 10:00:00Z",
  "2026-01-01T10:00Z",
  "2026-01-01T10:00:00+15:00",
  "2026-02-30T10:00:00Z",
  "2026-01-01T24:00:00Z",
  "2026-01-01T10:60:00Z"
 ])assert.throws(()=>validarSolicitudV81({...base,timestamp}),TypeError,timestamp);
});
test("V81 rechaza marca de tiempo futura",()=>{
 assert.throws(()=>validarSolicitudV81({...base,timestamp:"2099-01-01T10:00:00Z"}),TypeError);
});
