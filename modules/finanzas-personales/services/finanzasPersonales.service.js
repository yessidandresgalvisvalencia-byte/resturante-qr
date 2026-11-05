"use strict";
const mongoose=require("mongoose");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {resumenDesde,diarioDesde}=require("./reportesCompensadosPersonal.service");
const PrestamoPersonal=require("../models/prestamoPersonal.model");
const patrimonioFinanciero=require("./patrimonioPersonal.service");
const Movimiento=require("../models/movimiento.model");const Transaccion=require("../models/TransaccionPersonal");const Credito=require("../models/credito.model");const Perfil=require("../models/perfil.model");const Meta=require("../models/meta.model");const Activo=require("../models/activo.model");const Inversion=require("../models/inversion.model");const PerfilInversion=require("../models/perfilInversion.model");
const {monthStart,nextMonth}=require("./homePersonal.service")._fechas;
function gastoAfectaCaja(tx){return Boolean(tx&&tx.tipo==="GASTO"&&tx.medioPago!=="CREDITO");}
async function registrarMovimiento(userId,data){const session=await mongoose.startSession();try{let doc;await session.withTransaction(async()=>{[doc]=await Movimiento.create([{userId,...data}],{session});});return doc;}finally{await session.endSession();}}
function periodoInclusivo(desde,hasta){
 const inicio=new Date(desde??"0001-01-01T00:00:00.000Z");
 const ultimo=new Date(hasta??"9999-12-31T23:59:59.998Z");
 const fin=new Date(+ultimo+1);
 if(!Number.isFinite(+inicio)||!Number.isFinite(+fin)||inicio>=fin)
  throw Object.assign(new Error("Periodo inválido"),{statusCode:400});
 return{desde:inicio.toISOString(),hasta:fin.toISOString()};
}
async function diario(userId,{desde,hasta,limit=100}={}){
 if(!Number.isSafeInteger(limit)||limit<1)throw Object.assign(new Error("Límite inválido"),{statusCode:400});
 const rows=await consultarPeriodo({usuarioId:userId,...periodoInclusivo(desde,hasta)});
 return diarioDesde(rows,Math.min(limit,500));
}
async function resumenPeriodo(userId,{desde,hasta}){
 if(desde==null||hasta==null)throw Object.assign(new Error("Periodo obligatorio"),{statusCode:400});
 const rows=await consultarPeriodo({usuarioId:userId,...periodoInclusivo(desde,hasta)});
 return{desde,hasta,...resumenDesde(rows),fuente:"ledger_canonico"};
}
async function upsertPerfil(userId,data){return Perfil.findOneAndUpdate({userId},{$set:data,$setOnInsert:{userId}},{new:true,upsert:true,runValidators:true});}
async function registrarActivo(userId,data,{solicitudId}={}){return require("./creacionActivoRecuperablePersonal.service").crear(userId,solicitudId,data);}
async function registrarInversion(userId,data,{solicitudId}={}){return require("./creacionInversionRecuperablePersonal.service").crear(userId,solicitudId,data);}
async function upsertPerfilInversion(userId,data){return PerfilInversion.findOneAndUpdate({userId},{$set:data,$setOnInsert:{userId}},{new:true,upsert:true,runValidators:true});}
async function patrimonio(userId){const p=await patrimonioFinanciero.snapshot(userId);return{activosBase:patrimonioFinanciero.sumaPatrimonialSegura([p.liquidezMinor,p.activosNoLiquidosMinor]),valorInversiones:p.valorInversionesMinor,capitalInvertido:p.capitalInvertidoMinor,resultadoInversiones:p.resultadoInversionesMinor,deudas:p.pasivosMinor,patrimonioNeto:p.patrimonioFinancieroNetoMinor,cuentasPorCobrar:p.cuentasPorCobrarMinor,activos:p.activos,activosPreviosPorRevisar:p.activosPreviosPorRevisar,inversiones:p.inversiones,criterioInversiones:p.criterioInversiones,fuente:"ledger_personal_canonico"};}
async function planFinanciero(userId){
 const r=await resumen(userId);
 return{estado:"PENDIENTE_PLAN_VERIFICABLE",resumen:r,patrimonio:{patrimonioNetoRegistrado:r.patrimonioNeto},flujoLibre:null,objetivoFondoEmergencia:null,brechaFondoEmergencia:null,reservaFondoSugerida:null,capacidadInvertibleAhora:null,perfilInversion:null,perfilInversionConsultado:false,bloqueos:["El flujo registrado no determina un aporte de ahorro o inversión. Falta un plan de objetivos, fechas y liquidez verificable."],criterio:"No se infieren reservas ni capacidad desde un saldo de perfil, meses por defecto o un flujo proyectado."};
}
async function registrarCredito(userId,data){return Credito.create({userId,...data});}
async function crearMeta(userId,data){return Meta.create({userId,...data});}
async function resumen(userId,now=new Date()){return require("./resumenHttpPersonal.service").resumen(userId,now);}
function simularCredito({capital,tasaMensualPct,meses}){const r=tasaMensualPct/100;const cuota=r===0?capital/meses:capital*(r*Math.pow(1+r,meses))/(Math.pow(1+r,meses)-1);const total=cuota*meses;const tea=(Math.pow(1+r,12)-1)*100;return{cuotaMensual:Number(cuota.toFixed(2)),costoTotal:Number(total.toFixed(2)),interesesEstimados:Number((total-capital).toFixed(2)),tasaMensualPct,tasaEfectivaAnualPct:Number(tea.toFixed(2)),meses};}
async function evaluarCredito(userId,input){
 const base=await resumen(userId);
 return{estado:"PENDIENTE_EVALUACION_EXACTA",simulacion:null,requiereSimulacionExacta:true,contexto:{ingresosRegistrados:base.ingresos,flujoRegistrado:base.flujoRealizado,flujoLibreActual:null,flujoLibrePosterior:null,cargaDeudaPosteriorPct:null},alertas:["No se autoriza crédito a partir del flujo registrado. Se requiere simulación monetaria exacta, calendario, cargos y liquidez verificados."],supuestos:"La simulación antigua permanece separada y no se usa para evaluar capacidad ni para aprobar crédito."};
}
module.exports={gastoAfectaCaja,registrarMovimiento,diario,resumenPeriodo,upsertPerfil,registrarActivo,registrarInversion,upsertPerfilInversion,patrimonio,planFinanciero,registrarCredito,crearMeta,resumen,simularCredito,evaluarCredito};