"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {conciliarCuotasPrevistas}=require(
 "../../modules/finanzas-personales/services/conciliarCuotasPrevistasPersonal.service");
const uid="507f1f77bcf86cd799439011",id="507f1f77bcf86cd799439012";
const origen={_id:id,usuarioId:uid,tipo:"GASTO",impactoCaja:false,
 cuentaId:null,cuenta:"SIN_CAJA",estado:"ACTIVA",recurrente:true,
 frecuencia:"MENSUAL",montoMinor:500000,fecha:new Date("2026-11-15T12:00:00Z")};
const rango={usuarioId:uid,origen,
 desde:"2026-11-01T05:00:00Z",hasta:"2027-02-01T05:00:00Z"};
const pago=(id,fecha,montoMinor)=>({_id:id,usuarioId:uid,
 recurrenteOrigenId:origen._id,tipo:"GASTO",impactoCaja:true,
 estado:"ACTIVA",fecha:new Date(fecha),montoMinor});
test("abonos de días diferentes suman una cuota, no dos",()=>{
 const p=[
  pago("507f1f77bcf86cd799439020","2026-11-16T12:00:00Z",200000),
  pago("507f1f77bcf86cd799439021","2026-11-18T12:00:00Z",100000),
  pago("507f1f77bcf86cd799439022","2026-12-20T12:00:00Z",500000)
 ];
 const r=conciliarCuotasPrevistas({...rango,pagos:p});
 assert.equal(r.cuotas.length,3);
 assert.deepEqual(r.cuotas.map(x=>x.pendienteMinor),["200000","0","500000"]);
 assert.deepEqual(r.cuotas.map(x=>x.estado),["PARCIAL","PAGADA","PENDIENTE"]);
 assert.equal(r.totalBrutoMinor,"1500000");
 assert.equal(r.totalPagadoMinor,"800000");
 assert.equal(r.totalPendienteMinor,"700000");
 assert.equal(r.aptoParaDisponibleHoy,false);
});
test("rechaza doble contabilización de mismo pago o sobrepago",()=>{
 const p=pago("507f1f77bcf86cd799439020","2026-11-16T12:00:00Z",250000);
 assert.throws(()=>conciliarCuotasPrevistas({...rango,pagos:[p,p]}),
  e=>e.statusCode===409);
 const b=pago("507f1f77bcf86cd799439021","2026-11-18T12:00:00Z",250001);
 assert.throws(()=>conciliarCuotasPrevistas({...rango,pagos:[p,b]}),
  e=>e.statusCode===409&&/exceden/.test(e.message));
});
test("rechaza pagos de otros usuarios, origen, anulados y sin impacto caja",()=>{
 const p=pago("507f1f77bcf86cd799439020","2026-11-16T12:00:00Z",100000);
 for(const cambio of [
  {usuarioId:"507f1f77bcf86cd799439099"},
  {recurrenteOrigenId:"507f1f77bcf86cd799439099"},
  {estado:"ANULADA"},{impactoCaja:false},{montoMinor:0},
  {tipo:"INGRESO"}
 ])assert.throws(()=>conciliarCuotasPrevistas({
  ...rango,pagos:[{...p,...cambio}]
 }),e=>e.statusCode===409);
});
test("pago a fin de mes se aplica al ciclo civil correcto",()=>{
 const o={...origen,fecha:new Date("2027-01-31T22:00:00Z")};
 const p={...pago("507f1f77bcf86cd799439020",
  "2027-02-28T23:00:00Z",300000),recurrenteOrigenId:o._id};
 const r=conciliarCuotasPrevistas({usuarioId:uid,origen:o,
  pagos:[p],desde:"2027-02-01T05:00:00Z",hasta:"2027-04-01T05:00:00Z"});
 assert.equal(r.cuotas.length,2);
 assert.deepEqual(r.cuotas.map(x=>x.pendienteMinor),["200000","500000"]);
});
test("sumas BigInt no pierden precisión al superar Number.MAX_SAFE_INTEGER",()=>{
 const max=Number.MAX_SAFE_INTEGER;
 const o={...origen,montoMinor:max};
 const r=conciliarCuotasPrevistas({usuarioId:uid,origen:o,pagos:[],
  ...{desde:"2026-11-01T05:00:00Z",hasta:"2027-02-01T05:00:00Z"}});
 assert.equal(r.totalPendienteMinor,(3n*BigInt(max)).toString());
});
