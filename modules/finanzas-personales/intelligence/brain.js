"use strict";
const service=require("../services/finanzasPersonales.service");
async function analizar(userId){
 const r=await service.resumen(userId),negativo=r.flujoRealizado<0;
 return{generadoEn:new Date(),resumen:r,planFinanciero:null,estado:"PENDIENTE_PLAN_VERIFICABLE",hallazgos:[{nivel:negativo?"ALTO":"DATOS_PENDIENTES",codigo:negativo?"FLUJO_REGISTRADO_NEGATIVO":"PLAN_PENDIENTE",mensaje:negativo?"Las salidas del flujo registrado superan sus entradas; no es una medición de Disponible Hoy.":"Un flujo registrado no certifica ahorro, fondo de emergencia ni capacidad de inversión."}],ordenes:[{prioridad:1,accion:"Revisa saldos, calendario y objetivos antes de definir nuevos compromisos.",kpi:"EVIDENCIA_PENDIENTE"}]};
}
module.exports={analizar};
