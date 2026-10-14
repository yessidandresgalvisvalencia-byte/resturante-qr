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
test("calendario mensual genera una fecha por mes incluso al final de febrero",()=>{
 const {fechasCalendario}=require("../../modules/finanzas-personales/services/proyeccionMaster90d.service");
 const fechas=fechasCalendario({diaMes:31},new Date("2026-01-30T00:00:00Z"),90);
 assert.deepEqual(fechas.map(x=>x.toISOString().slice(0,10)),["2026-01-31","2026-02-28","2026-03-31"]);
});
test("cuota única de un millón no se triplica entre 30 60 y 90 días",()=>{
 const r=proyectarVentanas({corte:"2026-10-13T00:00:00Z",obligaciones:[{montoMinor:1000000,fecha:"2026-10-15T00:00:00Z"}]});
 assert.deepEqual(r.map(x=>x.obligacionesConFechaMinor),[1000000,1000000,1000000]);
 assert.deepEqual(r.map(x=>x.numeroObligaciones),[1,1,1]);
});
test("ingresos programados mensuales sí se acumulan por ventana",()=>{
 const {fechasCalendario}=require("../../modules/finanzas-personales/services/proyeccionMaster90d.service");
 const fechas=fechasCalendario({diaMes:20},new Date("2026-10-13T00:00:00Z"),90);
 const ingresos=fechas.map(fecha=>({fecha,montoMinor:2000000}));
 const r=proyectarVentanas({corte:"2026-10-13T00:00:00Z",ingresos});
 assert.deepEqual(r.map(x=>x.ingresosConFechaMinor),[2000000,4000000,6000000]);
});
