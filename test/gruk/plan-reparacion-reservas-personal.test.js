"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {planearReparacionReservas}=require(
 "../../modules/finanzas-personales/services/planReparacionReservasPersonal.service");
const uid="507f1f77bcf86cd799439011",id="507f1f77bcf86cd799439012";
const fecha="2026-11-15T05:00:00.000Z";
const params={usuarioId:uid,origenId:id};
const audit=anomalías=>({estado:anomalías.length?"REQUIERE_CONCILIACION":"COHERENTE",
 anomalías,soloLectura:true,aptoParaDisponibleHoy:false});
test("previsualización detecta diferencia exacta de un peso, sin escribir",()=>{
 const dictamen=audit([{codigo:"RESERVA_DESCUADRADA",periodoInicio:fecha,
  esperadoMinor:"200000",observadoMinor:"199999"}]);
 const p=planearReparacionReservas({...params,auditoria:dictamen});
 assert.equal(p.acciones[0].deltaMinor,"1");
 assert.equal(p.autorizaEscritura,false);
 assert.equal(p.aptoParaDisponibleHoy,false);
 assert.equal(p.requiereReauditoriaAtomica,true);
 assert.deepEqual(dictamen.anomalías[0],{codigo:"RESERVA_DESCUADRADA",
  periodoInicio:fecha,esperadoMinor:"200000",observadoMinor:"199999"});
 assert.equal(p.huellaDiagnostico.length,64);
});
test("planifica delta negativo sin floats ni cambios automáticos",()=>{
 const p=planearReparacionReservas({...params,auditoria:audit([{
  codigo:"RESERVA_DESCUADRADA",periodoInicio:fecha,
  esperadoMinor:"200000",observadoMinor:"200001"
 }])});
 assert.equal(p.acciones[0].deltaMinor,"-1");
});
test("reserva faltante no equivale a un pago ni a un débito",()=>{
 const p=planearReparacionReservas({...params,auditoria:audit([{
  codigo:"FALTA_RESERVA",periodoInicio:fecha,esperadoMinor:"250000"
 }])});
 assert.equal(p.acciones[0].propuesta,"CREAR_RESERVA_PREVIA_REVISION");
 assert.equal(p.acciones[0].deltaMinor,"250000");
});
test("errores de período y reserva sin abonos obligan revisión manual",()=>{
 for(const codigo of ["PERIODO_INCORRECTO","RESERVA_SIN_ABONOS"]){
  const p=planearReparacionReservas({...params,auditoria:audit([{
   codigo,periodoInicio:fecha
  }])});
  assert.equal(p.acciones[0].propuesta,"REVISION_MANUAL");
  assert.equal(p.acciones[0].deltaMinor,null);
 }
});
test("sin diferencias no propone cambios",()=>{
 const p=planearReparacionReservas({...params,auditoria:audit([])});
 assert.equal(p.estado,"SIN_DIFERENCIAS");
 assert.deepEqual(p.acciones,[]);
});
test("rechaza dictámenes contradictorios, repetidos y malformados",()=>{
 for(const auditoria of [
  {...audit([]),estado:"REQUIERE_CONCILIACION"},
  audit([{codigo:"RESERVA_DESCUADRADA",periodoInicio:fecha,
   esperadoMinor:"1",observadoMinor:"0.1"}]),
  audit([{codigo:"FALTA_RESERVA",periodoInicio:fecha,
   esperadoMinor:"-1"}]),
  audit([{codigo:"FALTA_RESERVA",periodoInicio:"2026-02-30T00:00:00.000Z",
   esperadoMinor:"100"}]),
  audit([{codigo:"DESCONOCIDO",periodoInicio:fecha}]),
  audit([{codigo:"FALTA_RESERVA",periodoInicio:fecha,esperadoMinor:"100"},
   {codigo:"RESERVA_DESCUADRADA",periodoInicio:fecha,
    esperadoMinor:"100",observadoMinor:"99"}]),
  {...audit([]),aptoParaDisponibleHoy:true}
 ])assert.throws(()=>planearReparacionReservas({...params,auditoria}),
  e=>e.statusCode===409);
});
test("BigInt exacto y huella determinística para importes grandes",()=>{
 const v="900719925474099300000000000";
 const params2={...params,auditoria:audit([{
  codigo:"RESERVA_DESCUADRADA",periodoInicio:fecha,
  esperadoMinor:v,observadoMinor:"1"
 }])};
 const a=planearReparacionReservas(params2),b=planearReparacionReservas(params2);
 assert.equal(a.acciones[0].deltaMinor,(BigInt(v)-1n).toString());
 assert.equal(a.huellaDiagnostico,b.huellaDiagnostico);
});
