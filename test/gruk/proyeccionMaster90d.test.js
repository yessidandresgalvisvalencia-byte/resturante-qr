"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {proyectarVentanas}=require("../../modules/finanzas-personales/services/proyeccionMaster90d.service");
test("proyección no inventa entradas futuras ni dinero sin verificar",()=>{
 const r=proyectarVentanas({corte:"2026-10-13T00:00:00Z",saldoMinor:52000,saldoVerificado:false});
 assert.deepEqual(r.map(x=>x.dias),[30,60,90]);assert.ok(r.every(x=>x.saldoCondicionalMinor===null&&x.estado==="PARCIAL"));
});
test("cada compromiso conocido se descuenta una sola vez por horizonte",()=>{
 const r=proyectarVentanas({corte:"2026-10-13T00:00:00Z",saldoMinor:1000000,saldoVerificado:true,ingresos:[{montoMinor:200000,fecha:"2026-10-20T00:00:00Z"}],obligaciones:[{montoMinor:150000,fecha:"2026-10-15T00:00:00Z"},{montoMinor:100000,fecha:"2026-12-01T00:00:00Z"}]});
 assert.equal(r[0].saldoCondicionalMinor,1050000);assert.equal(r[1].saldoCondicionalMinor,950000);assert.equal(r[2].saldoCondicionalMinor,950000);
});
test("ignora fechas anteriores al corte y rechaza importes inválidos",()=>{
 const r=proyectarVentanas({corte:"2026-10-13T00:00:00Z",saldoMinor:1000,saldoVerificado:true,ingresos:[{montoMinor:500,fecha:"2026-10-12T00:00:00Z"}]});
 assert.equal(r[0].saldoCondicionalMinor,1000);
 assert.throws(()=>proyectarVentanas({ingresos:[{montoMinor:-10,fecha:new Date()}]}),TypeError);
});