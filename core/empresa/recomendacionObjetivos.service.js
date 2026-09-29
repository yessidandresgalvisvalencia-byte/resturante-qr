"use strict";
const mongoose=require("mongoose");
const Empresa=require("../../models/Empresa");
const {obtenerResumenVentas,obtenerResumenGastos}=require("../finanzas/finanzas.service");
function inicioMes(d){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1));}
function finMes(d){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));}
async function recomendarMargenObjetivo(empresaId){
 if(!mongoose.Types.ObjectId.isValid(empresaId))throw Object.assign(new Error("empresaId inválido"),{statusCode:400});
 const empresa=await Empresa.findById(empresaId).select("_id configuracion.margen_objetivo").lean();
 if(!empresa)throw Object.assign(new Error("Empresa no encontrada"),{statusCode:404});
 if(empresa.configuracion?.margen_objetivo!=null)return{campo:"margen_objetivo",estado:"YA_CONFIGURADO",valor:Number(empresa.configuracion.margen_objetivo),departamento:"FINANZAS",confianza:100};
 const ahora=new Date(),desde=inicioMes(ahora),hasta=finMes(ahora);
 const [v,g]=await Promise.all([obtenerResumenVentas({empresaId:empresa._id,desde,hasta}),obtenerResumenGastos({empresaId:empresa._id,desde,hasta})]);
 const cobertura=Number(v.coberturaCostoPorcentaje||0),margen=Number(v.margenBrutoConfiable);
 if(v.ventasTotales<10||cobertura<80||!Number.isFinite(margen)||v.ingresosConCostoConfiable<=0){
  return{campo:"margen_objetivo",estado:"EVIDENCIA_INSUFICIENTE",valor:null,departamento:"FINANZAS",confianza:Math.round(cobertura),que:"Todavía no recomiendo un margen objetivo numérico.",por_que:"Necesito al menos 10 ventas del periodo y costos confiables en 80% o más de las ventas para que la base no sea engañosa.",como:"Finanzas mide ventas pagadas y solo usa costos congelados como confiables.",para_que:"Evitar fijar precios o metas de rentabilidad sobre costos incompletos.",datos:{ventas:v.ventasTotales,cobertura_costos:cobertura}};
 }
 const gastos=Number(g.montoGastosRegistrados||0),ingresos=Number(v.ingresosConCostoConfiable||0);
 const cargaGastos=ingresos>0?(gastos/ingresos)*100:0;
 // Objetivo inicial = margen bruto observado + colchón basado únicamente en gastos registrados no absorbidos.
 // El colchón se limita para no fabricar una meta agresiva con un solo mes.
 const colchón=Math.min(10,Math.max(2,cargaGastos*0.15));
 const recomendado=Math.min(100,Number((margen+colchón).toFixed(2)));
 const confianza=Math.min(95,Math.round(cobertura));
 return{campo:"margen_objetivo",estado:"RECOMENDADO",valor:recomendado,departamento:"FINANZAS",confianza,que:`Finanzas recomienda un margen objetivo inicial de ${recomendado}%.`,como:`Partí del margen bruto confiable observado (${margen.toFixed(2)}%) y añadí un colchón prudente de ${colchón.toFixed(2)} puntos basado en la carga de gastos registrados, limitado a 10 puntos para no sobrerreaccionar a un solo periodo.`,por_que:"El margen objetivo debe dejar espacio para sostener la estructura del negocio; copiar exactamente el margen actual no crea una meta de mejora.",para_que:"Dar a GRUK una referencia inicial defendible para detectar deterioro de rentabilidad y orientar precios/costos.",como_medir:"Revisar margen bruto confiable, cobertura de costos y gastos sobre ingresos cada mes.",datos:{ventas:v.ventasTotales,cobertura_costos:cobertura,margen_observado:margen,gastos_registrados:gastos,ingresos_con_costo_confiable:ingresos,carga_gastos_porcentaje:Number(cargaGastos.toFixed(2))}};
}
module.exports={recomendarMargenObjetivo};