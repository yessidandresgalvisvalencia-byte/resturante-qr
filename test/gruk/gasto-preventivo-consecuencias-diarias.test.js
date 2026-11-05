"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");
const servicePath=path.resolve(__dirname,"../../modules/finanzas-personales/services/gastoInteligentePersonal.service.js");
const homePath=path.resolve(__dirname,"../../modules/finanzas-personales/services/homePersonal.service.js");
const {consecuenciaDiaria}=require(servicePath);
const homeVerificado=require("../finanzas-personales/helpers/homeVerificadoFixture");
const ahora=new Date("2026-10-20T15:00:00.000Z");
test("compra preventiva divide solo dinero libre en dias civiles de Bogotá con enteros",()=>{
 const r=consecuenciaDiaria({disponibleMinor:250000,montoMinor:80000,fechaIngreso:new Date("2026-11-01T05:00:00Z"),ahora});
 assert.deepEqual(r,{restanteMinor:170000,diasHastaIngreso:12,promedioDiarioMinor:14166,estimacion:"PROYECCION_NO_PRESUPUESTO"});
 assert.equal(Number.isInteger(r.promedioDiarioMinor),true);
});
test("gasto superior al disponible nunca presenta cupo diario positivo",()=>{
 const r=consecuenciaDiaria({disponibleMinor:3000000,montoMinor:4000000,fechaIngreso:"2026-10-22T05:00:00Z",ahora});
 assert.equal(r.restanteMinor,-1000000);
 assert.equal(r.promedioDiarioMinor,0);
});
test("fecha de ingreso vencida no inventa horizonte de liquidez",()=>{
 const r=consecuenciaDiaria({disponibleMinor:250000,montoMinor:100000,fechaIngreso:"2026-10-19T05:00:00Z",ahora});
 assert.equal(r.diasHastaIngreso,null);assert.equal(r.promedioDiarioMinor,null);
});
test("rechaza dinero en coma flotante, valores negativos y desbordamiento",()=>{
 for(const monto of [0,-1,0.1,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>consecuenciaDiaria({disponibleMinor:250000,montoMinor:monto,fechaIngreso:new Date(),ahora}),/enteros seguros/);
});
test("evaluación nunca autoriza compra si saldo necesita conciliación",async()=>{
 const home=require(homePath);
 const previo=home.obtener;
 home.obtener=async()=>({asesor:{saldoRealConocido:true,aptoParaDisponibleHoy:false,disponibleHoyMinor:null,proximoIngresoConocido:true,proximoIngreso:{fecha:"2026-11-01T05:00:00Z"}}});
 delete require.cache[servicePath];
 try{
  const {evaluar}=require(servicePath);
  const r=await evaluar("cuenta-prueba",{montoMinor:100000});
  assert.equal(r.estado,"FALTAN_DATOS");
  assert.match(r.mensaje,/conciliado/);
 }finally{home.obtener=previo;delete require.cache[servicePath]}
});

test("fechas civiles de Colombia no se desplazan al día anterior y respetan año bisiesto",()=>{
 for(const [fecha,desde,dias] of [
  ["2026-10-21",ahora,1],
  ["2026-10-21T00:00:00-05:00",ahora,1],
  ["2026-10-21T04:59:59Z",ahora,null],
  ["2028-02-29",new Date("2028-02-28T15:00:00Z"),1],
  ["2027-01-01",new Date("2026-12-31T15:00:00Z"),1]
 ]){
  const r=consecuenciaDiaria({disponibleMinor:100,montoMinor:1,fechaIngreso:fecha,ahora:desde});
  assert.equal(r.diasHastaIngreso,dias,fecha);
 }
});
const fechasInvalidas=[undefined,null,true,false,0,42,[],["2026-10-21"],{},"",
 "mañana","2026-02-30","2027-02-29","2026-13-01","2026-10-32",
 "2026-10-21T12:00:00","2026-02-30T05:00:00Z","2026-10-21T24:00:00Z",
 "2026-10-21T12:00:00+14:30",new Date("invalid")];
test("fechas coercibles, normalizadas o sin zona no generan proyecciones",()=>{
 for(const fechaIngreso of fechasInvalidas){
  const r=consecuenciaDiaria({disponibleMinor:100,montoMinor:1,fechaIngreso,ahora});
  assert.equal(r.estimacion,"FECHA_NO_VERIFICADA",String(fechaIngreso));
  assert.equal(r.promedioDiarioMinor,null);
 }
});
function asesorVerificado(){return{
 aptoParaDisponibleHoy:true,saldoRealConocido:true,saldoConfiabilidad:"VERIFICADO",
 saldoRequiereReconciliacion:false,disponibleHoyMinor:250000,
 proximoIngresoConocido:true,proximoIngreso:{fecha:"2026-10-22",montoMinor:1000000},
 compromisosAntesProximoIngreso:[]
};}
async function conHome(obtener,prueba){
 const home=require(homePath),previo=home.obtener;
 home.obtener=obtener;
 try{return await prueba(require(servicePath));}finally{home.obtener=previo;}
}
test("evaluación cerrada sin fecha futura válida ni importe positivo conocido del ingreso",async()=>{
 for(const fecha of [...fechasInvalidas,"2026-10-19","2026-10-20","2026-10-20T23:59:59-05:00"]){
  const a=asesorVerificado();a.proximoIngreso.fecha=fecha;
  await conHome(async()=>homeVerificado(ahora,a),async({evaluar})=>{
   const r=await evaluar("propietario",{montoMinor:100000},{ahora});
   assert.equal(r.estado,"FALTAN_DATOS",String(fecha));
   assert.deepEqual(Object.keys(r).sort(),["estado","mensaje"]);
  });
 }
 for(const monto of [undefined,null,0,-1,0.5,"100",Number.MAX_SAFE_INTEGER+1]){
  const a=asesorVerificado();a.proximoIngreso.montoMinor=monto;
  await conHome(async()=>homeVerificado(ahora,a),async({evaluar})=>{
   assert.equal((await evaluar("propietario",{montoMinor:1},{ahora})).estado,"FALTAN_DATOS");
  });
 }
});
test("evaluación exige señales explícitas de conciliación y disponible no negativo",async()=>{
 const variantes=[
  {aptoParaDisponibleHoy:1},{aptoParaDisponibleHoy:"true"},{aptoParaDisponibleHoy:undefined},
  {saldoRealConocido:false},{saldoRealConocido:undefined},{saldoConfiabilidad:"RECONSTRUIDO_SIN_ANCLA"},
  {saldoConfiabilidad:undefined},{saldoRequiereReconciliacion:true},{saldoRequiereReconciliacion:undefined},
  {proximoIngresoConocido:"true"},{proximoIngresoConocido:false},
  ...[-1,0.1,"100",null,Number.MAX_SAFE_INTEGER+1].map(disponibleHoyMinor=>({disponibleHoyMinor}))
 ];
 for(const cambio of variantes)await conHome(async()=>homeVerificado(ahora,{...asesorVerificado(),...cambio}),async({evaluar})=>{
  assert.equal((await evaluar("propietario",{montoMinor:100},{ahora})).estado,"FALTAN_DATOS");
 });
 for(const h of [null,{}, {asesor:null}])await conHome(async()=>h,async({evaluar})=>{
  assert.equal((await evaluar("propietario",{montoMinor:100},{ahora})).estado,"FALTAN_DATOS");
 });
});
test("evaluación vigente mantiene CABE, NO_CABE y REQUIERE_PLAN sin alterar la fuente",async()=>{
 const a=asesorVerificado();Object.freeze(a.proximoIngreso);Object.freeze(a.compromisosAntesProximoIngreso);Object.freeze(a);
 const antes=JSON.stringify(a),usuarios=[];
 await conHome(async usuario=>{usuarios.push(usuario);return homeVerificado(ahora,a);},async({evaluar})=>{
  const cabe=await evaluar("propietario",{montoMinor:100000},{ahora});
  assert.equal(cabe.estado,"CABE");assert.equal(cabe.restanteMinor,150000);
  assert.equal(cabe.consecuencia.diasHastaIngreso,2);assert.equal(cabe.consecuencia.promedioDiarioMinor,75000);
  const justo=await evaluar("propietario",{montoMinor:250000},{ahora});
  assert.equal(justo.estado,"CABE");assert.equal(justo.restanteMinor,0);
  const noCabe=await evaluar("propietario",{montoMinor:300000},{ahora});
  assert.equal(noCabe.estado,"NO_CABE");assert.equal(noCabe.impactoMinor,50000);
  const obligacion=await evaluar("propietario",{montoMinor:300000,obligatorio:true},{ahora});
  assert.equal(obligacion.estado,"REQUIERE_PLAN");assert.equal(obligacion.impactoMinor,50000);
  const credito=await evaluar("propietario",{montoMinor:100000,credito:{interesesMinor:1000,cargosMinor:500,cuotas:2}},{ahora});
  assert.equal(credito.metodos[1].costoTotalMinor,101500);
 });
 assert.deepEqual(usuarios,Array(5).fill("propietario"));assert.equal(JSON.stringify(a),antes);
});
test("precio u obligatoriedad inválidos fallan antes de leer y errores de home no autorizan",async()=>{
 await conHome(async()=>{throw new Error("no debe leer");},async({evaluar})=>{
  for(const input of [undefined,null,{}, {montoMinor:0},{montoMinor:1,obligatorio:"false"}])
   await assert.rejects(evaluar("propietario",input,{ahora}),e=>e.statusCode===400);
 });
 const fallo=Object.assign(new Error("lectura incompleta"),{statusCode:422});
 await conHome(async()=>{throw fallo;},async({evaluar})=>{
  await assert.rejects(evaluar("propietario",{montoMinor:1},{ahora}),e=>e===fallo);
 });
});
