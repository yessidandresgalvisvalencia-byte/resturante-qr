"use strict";
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {calcularFlujo}=require("./totalesFlujoCompensadoPersonal.service");
const Prestamo=require("../models/prestamoPersonal.model");
const home=require("./homePersonal.service");
const Accion=require("../models/accionProgresoPersonal.model");
function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);}
function entero(n,{negativo=false}={}){
 if(!Number.isSafeInteger(n)||!negativo&&n<0)throw new TypeError("Importe de progreso económico inválido");
 return BigInt(n);
}
function seguro(n){
 if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))throw new RangeError("Progreso económico fuera de rango seguro");
 return Number(n);
}
function metricasExactas(tx,cobros,asesor){
 const flujo=calcularFlujo(tx),ingresos=flujo.ingresosMinor,gastos=flujo.gastosMinor;
 const hormiga=calcularFlujo(tx.filter(x=>x.tipo==="GASTO"&&/hormiga/i.test(x.categoria||""))).gastosMinor;
 const porCobrar=seguro(cobros.reduce((n,c)=>n+entero(c.saldoMinor),0n));
 let brecha=0n;
 if(asesor.estaEnRojo===true){
  const diferencia=entero(asesor.saldoRealMinor,{negativo:true})-entero(asesor.gastosFijosAntesProximoIngresoMinor)-entero(asesor.colchonMinor);
  brecha=diferencia<0n?-diferencia:diferencia;
 }
 return {ingresos,gastos,hormiga,porCobrar,brechaLiquidez:seguro(brecha),
  ingresoObjetivoMes:seguro(BigInt(ingresos)+brecha),
  superaUmbralHormiga:ingresos>0&&BigInt(hormiga)*100n>BigInt(ingresos)*15n};
}
async function analizar(usuarioId,now=new Date()){const desde=home._fechas.monthStart(now);const [tx,deudas,h,cobros]=await Promise.all([consultarPeriodo({usuarioId,desde:desde.toISOString(),hasta:new Date(+now+1).toISOString()}),Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0}}).lean(),home.obtener(usuarioId,now),Prestamo.find({usuarioId,direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0}}).lean()]);const {ingresos,gastos,hormiga,porCobrar,brechaLiquidez,ingresoObjetivoMes,superaUmbralHormiga}=metricasExactas(tx,cobros,h.asesor);const ordenes=[];deudas.forEach(d=>entero(d.saldoMinor));if(porCobrar>0)ordenes.push({palanca:"INGRESOS",prioridad:"ALTA",accion:"Cobrar cuentas pendientes antes de buscar deuda nueva.",impactoObjetivoMinor:porCobrar,justificacion:"Hay "+money(porCobrar)+" registrados por cobrar. No se cuentan como caja hasta que entren realmente."});if(h.asesor.estaEnRojo)ordenes.push({palanca:"INGRESOS",prioridad:"CRITICA",accion:"Cubrir la brecha de liquidez antes del próximo ingreso.",impactoObjetivoMinor:brechaLiquidez,justificacion:"Es la brecha exacta entre liquidez registrada y dinero protegido."});if(superaUmbralHormiga)ordenes.push({palanca:"GASTO",prioridad:"ALTA",accion:"Revisar gasto hormiga recurrente.",impactoObjetivoMinor:hormiga,justificacion:"Este mes suma "+money(hormiga)+" y supera 15% de los ingresos registrados; GRUK no exige eliminarlo, sino decidir qué consumo aporta valor y cuál sustituir."});const costosas=deudas.filter(x=>Number(x.tasaMensualPct||0)>0).sort((a,b)=>b.tasaMensualPct-a.tasaMensualPct);if(costosas[0])ordenes.push({palanca:"DEUDA",prioridad:"ALTA",accion:"Evaluar abono extra a la deuda con mayor tasa solo con dinero realmente libre.",impactoObjetivoMinor:costosas[0].saldoMinor,justificacion:"Reducir principal de deuda con interés puede disminuir costo financiero; el ahorro exacto requiere calendario y condiciones del crédito."});if(!ordenes.length)ordenes.push({palanca:"INGRESOS",prioridad:"MEDIA",accion:"Registrar una fuente de ingreso adicional cuando ocurra para medir si aumenta tu ingreso mensual real.",impactoObjetivoMinor:0,justificacion:"GRUK no inventa una oportunidad ni una ganancia sin datos sobre habilidades, tiempo, oferta o ventas reales."});const pc=home._fechas.partesColombia(now);const periodoKey=pc.y+"-"+String(pc.m).padStart(2,"0");const clavesVigentes=[];for(const o of ordenes){const clave=periodoKey+":"+o.palanca+":"+String(o.accion).slice(0,80);clavesVigentes.push(clave);
const datos={palanca:o.palanca==="INGRESOS"&&/Cobrar/i.test(o.accion)?"COBRO":o.palanca,titulo:o.accion,
 objetivoMinor:o.impactoObjetivoMinor||0,baselineMinor:o.palanca==="INGRESOS"?ingresos:o.palanca==="GASTO"?gastos:o.palanca==="DEUDA"?(costosas[0]?.saldoMinor||0):porCobrar};
await Accion.updateOne({usuarioId,clave},{$setOnInsert:{usuarioId,clave,...datos,estado:"PROPUESTA"}},{upsert:true,runValidators:true});
await Accion.updateOne({usuarioId,clave,estado:"PROPUESTA"},{$set:datos},{runValidators:true});
}
const acciones=await Accion.find({usuarioId,$or:[{estado:"APROBADA"},{estado:"PROPUESTA",clave:{$in:clavesVigentes}}]})
 .sort({createdAt:-1}).limit(20).lean();const progreso={objetivo:"AUTONOMIA_FINANCIERA",ingresoBaseMinor:ingresos,ingresoObjetivoMesMinor:ingresoObjetivoMes,brechaLiquidezMinor:brechaLiquidez,porCobrarRecuperableMinor:porCobrar,patrimonioNetoMinor:h.patrimonio.netoMinor,estaEnRojo:Boolean(h.asesor.estaEnRojo),liquidezProtegidaEstePeriodo:brechaLiquidez===0&&h.asesor.disponibleHoyMinor>0};return{periodo:{desde,hasta:now},metricas:{ingresosMinor:ingresos,gastosMinor:gastos,gastoHormigaMinor:hormiga,porCobrarMinor:porCobrar,disponibleHoyMinor:h.asesor.disponibleHoyMinor,patrimonioNetoMinor:h.patrimonio.netoMinor},progreso,ordenes,acciones,criterio:"GRUK persigue autonomía financiera con mejora económica verificable. Liquidez protegida no equivale a autonomía financiera: no cuenta promesas como ingresos ni declara progreso sin evidencia del ledger."};}
module.exports={analizar,metricasExactas};
