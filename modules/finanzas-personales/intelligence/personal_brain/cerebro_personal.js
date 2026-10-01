"use strict";
const flujo=require("../neurons/flujoDeCaja.neuron");
const deuda=require("../neurons/deuda.neuron");
const Decision=require("../../models/decisionPersonal.model");
const clamp=n=>Math.max(0,Math.min(100,n));
async function tomarDecisionPersonal(usuarioId,opts){
 const {desde,hasta,objetivoAhorroPct=20,ingresoMensual=0,pagoExtraDisponible=0,umbralCargaPct=35}=opts;
 const [rf,rd]=await Promise.all([flujo.analyze(usuarioId,{desde,hasta,objetivoAhorroPct}),deuda.analyze(usuarioId,{ingresoMensual,pagoExtraDisponible,umbralCargaPct})]);
 const ordenes=[];let score=100,impacto=0;
 if(rf.kpi_principal.estado==="CRITICO"){score-=35;impacto=rf.hallazgos[0]?.impacto_anual_estimado||0;ordenes.push({categoria:"FLUJO",tarea:"Restablecer flujo de caja positivo antes de aumentar gasto discrecional o inversión.",prioridad:"CRITICA",impacto_estimado_minor:impacto});}
 else if(rf.kpi_principal.estado==="ALERTA"){score-=15;ordenes.push({categoria:"AHORRO",tarea:"Cerrar la brecha frente a la tasa de ahorro objetivo configurada.",prioridad:"MEDIA"});}
 if(rd.reporte.kpi_principal.estado==="CRITICO"){score-=35;ordenes.push({categoria:"DEUDA",tarea:"Validar ingresos y capacidad de pago antes de asumir nuevas obligaciones.",prioridad:"CRITICA"});}
 else if(rd.reporte.kpi_principal.estado==="ALERTA"){score-=20;const x=rd.estrategias.avalancha[0];ordenes.push({categoria:"DEUDA",tarea:x?("Priorizar pago adicional sobre "+x.nombre+" por mayor tasa registrada."):"Reducir carga mensual de deuda.",prioridad:"ALTA"});}
 const top=ordenes.slice(0,3);
 return Decision.create({usuarioId,situacion_patrimonial:{salud_financiera_score:clamp(score),diagnostico_clave:top[0]?.tarea||"Sin alertas patrimoniales críticas con los datos analizados."},ordenes_de_accion:top,impacto_financiero_a_12_meses_minor:impacto,riesgo_si_no_se_ejecuta:top.length?"Persistencia o ampliación de la condición financiera detectada.":"Sin riesgo crítico cuantificado en este análisis."});
}
module.exports={tomarDecisionPersonal};