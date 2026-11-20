"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {createRequire}=require("node:module");
const ruta=require.resolve("../../modules/finanzas-personales/services/homePersonal.service");
const exigir=createRequire(ruta),codigo=fs.readFileSync(ruta,"utf8");
const ahora=new Date("2026-10-18T15:00:00Z"),usuarioId="507f1f77bcf86cd799439011";
function cargar({deudas=[],tarjetas=[],fallo=false,fuente=codigo}={}){
 const consultas=[];
 let session;
 const query=rows=>({sort(){return this;},limit(n){assert.equal(n,5001);return this;},
  session(s){assert.equal(s,session);return this;},maxTimeMS(n){assert.equal(n,5000);return this;},async lean(){if(fallo)throw new Error("lectura fallida");return rows;}});
 const modelo=seleccionar=>({find(filtro){assert.equal(filtro.usuarioId,usuarioId);consultas.push(filtro);return query(seleccionar(filtro));}});
 session={inTransaction:()=>true,withTransaction:async fn=>fn(),endSession:async()=>{}};
 const dependencias={
  mongoose:{connection:{readyState:1},isObjectIdOrHexString:require("mongoose").isObjectIdOrHexString,startSession:async()=>session},
  "../models/TransaccionPersonal":modelo(()=>[]),
  "../models/prestamoPersonal.model":modelo(f=>f.direccion==="POR_PAGAR"?deudas:[]),
  "../models/DeudaPersonal":modelo(()=>tarjetas),
  "../models/calendarioFinanciero.model":modelo(()=>[{_id:"c".repeat(24),usuarioId,tipo:"INGRESO",activo:true,frecuencia:"MENSUAL",diaMes:25,montoMinor:1000000,concepto:"Ingreso"}]),
  "./calendarioIngresoPersonal.service":{combinarLegados:exigir("./calendarioIngresoPersonal.service").combinarLegados,leerEnSesion:async()=>({calendarios:[],eventos:[]})},
  "./imputacionPagoPersonal.service":{leerEnSesion:async()=>new Map()},
  "./consultaCompensadaPersonal.service":{consultarPeriodo:async({usuarioId:id})=>{assert.equal(id,usuarioId);return[];}},
  "./patrimonioPersonal.service":{snapshotEnSesion:async (id,s)=>{
   assert.equal(s,session);
   assert.equal(id,usuarioId);
   return{saldoVerificado:true,liquidezMinor:1000000,fuenteLiquidez:"ANCLA_RECONCILIADA",cuentas:[],activos:[],
    activosTotalesMinor:1000000,cuentasPorCobrarMinor:0,pasivosMinor:0,patrimonioFinancieroNetoMinor:1000000};
  }}
 };
 const module={exports:{}};
 vm.runInNewContext(fuente,{module,require:p=>dependencias[p]||exigir(p),Date,Intl,Number,Math,Map,Set,Object,Array,BigInt,TypeError,RangeError,Error});
 return{home:module.exports,consultas};
}
const deuda={_id:"d",usuarioId,direccion:"POR_PAGAR",estado:"ACTIVO",saldoMinor:100000,principalMinor:100000,cuotaMinor:10000,concepto:"Préstamo"};
function bloqueado(panel,tipo){
 assert.equal(panel.asesor.aptoParaDisponibleHoy,false);
 assert.equal(panel.asesor.saldoConfiabilidad,"VERIFICADO");
 assert.equal(panel.asesor.disponibleHoyMinor,null);
 assert.equal(panel.asesor.gastoMaximoSiGravadoMinor,null);
 assert.equal(panel.verdadFinanciera.disponibleHoy.requiereReconciliacion,true);
 assert.equal(panel.asesor.obligacionesSinFecha[0].tipo,tipo);
 assert.ok(panel.decisiones.some(d=>d.accion==="CONFIRMAR_FECHA_PAGO"&&d.montoMinor===null));
}
test("home completo bloquea deuda sin vencimiento con saldo verificado y conserva la fuente",async()=>{
 const deudas=Object.freeze([Object.freeze({...deuda,fechaVencimiento:null})]);
 const antes=JSON.stringify(deudas),{home,consultas}=cargar({deudas});
 bloqueado(await home.obtener(usuarioId,ahora),"PRESTAMO");
 assert.equal(JSON.stringify(deudas),antes);assert.equal(consultas.length,5);
});
test("home bloquea tarjeta histórica sin día válido sin agregar un compromiso fechado inventado",async()=>{
 const tarjetas=[{_id:"t",tipo:"TARJETA_CREDITO",activa:true,saldoMinor:100000,pagoMinimoMinor:10000,nombre:"Tarjeta",diaPago:null}];
 const panel=await cargar({tarjetas}).home.obtener(usuarioId,ahora);
 bloqueado(panel,"TARJETA_CREDITO");
 assert.equal(panel.asesor.compromisosAntesProximoIngreso.length,0);
});
test("home conserva disponible y cuota separada cuando el vencimiento está confirmado",async()=>{
 const panel=await cargar({deudas:[{...deuda,fechaVencimiento:new Date("2026-10-20T05:00:00Z")}]}).home.obtener(usuarioId,ahora);
 assert.equal(panel.asesor.aptoParaDisponibleHoy,true);
 assert.equal(panel.asesor.disponibleHoyMinor,890000);
 assert.equal(panel.asesor.obligacionesSinFecha.length,0);
 assert.equal(panel.asesor.compromisosAntesProximoIngreso[0].montoMinor,10000);
});
test("un fallo de listado no devuelve una autorización ni un saldo cero",async()=>{
 await assert.rejects(cargar({fallo:true}).home.obtener(usuarioId,ahora),/lectura fallida/);
});
