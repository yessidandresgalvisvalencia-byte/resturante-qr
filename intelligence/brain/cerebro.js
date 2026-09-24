"use strict";
const mongoose=require("mongoose");
const Reporte=require("../models/CerebroReporteNeurona");
const Decision=require("../models/CerebroDecision");
const NEURONAS=["FINANZAS","VENTAS","MARKETING","OPERACIONES","GENTE"];
const MAPA={
 MARGEN_BAJO_OBJETIVO:{departamento:"FINANZAS",tarea:"Revisar costos y margen bruto frente al objetivo configurado.",kpi:"margen_bruto_confiable"},
 COSTO_NO_CONFIABLE:{departamento:"FINANZAS",tarea:"Completar costos confiables de los productos vendidos.",kpi:"cobertura_costo_porcentaje"},
 TICKET_BAJO_OBJETIVO:{departamento:"VENTAS",tarea:"Revisar ticket promedio y mezcla de productos frente al objetivo.",kpi:"ticket_promedio"},
 INVENTARIO_AGOTADO:{departamento:"OPERACIONES",tarea:"Reponer o resolver los items de inventario agotados.",kpi:"porcentaje_items_agotados"},
 SIN_INVENTARIO_CONFIGURADO:{departamento:"OPERACIONES",tarea:"Configurar el inventario operativo para poder medir disponibilidad.",kpi:"porcentaje_items_agotados"},
 DATOS_INSUFICIENTES:{departamento:"MARKETING",tarea:"Configurar atribucion de gasto y clientes adquiridos para medir CAC.",kpi:"cac"},
 CONFIGURACION_INCOMPLETA:{departamento:"DIRECCION",tarea:"Completar los objetivos empresariales requeridos por GRUK.",kpi:"configuracion_core"}
};
function prioridad(estado,impacto){if(estado==="CRITICO")return"CRITICA";if(impacto>0)return"ALTA";return"MEDIA";}
async function ultimosReportes(empresaId){
 const rows=await Reporte.find({empresaId,neurona:{$in:NEURONAS},deletedAt:null}).sort({timestamp:-1}).lean();
 const mapa=new Map(); for(const r of rows){if(!mapa.has(r.neurona))mapa.set(r.neurona,r);} return NEURONAS.map(n=>mapa.get(n)).filter(Boolean);
}
async function tomarDecision(empresaId){
 if(!mongoose.Types.ObjectId.isValid(empresaId))throw new Error("CEREBRO_EMPRESA_ID_INVALIDO");
 const reportes=await ultimosReportes(empresaId);
 if(reportes.length!==5)throw new Error("CEREBRO_REQUIERE_CINCO_REPORTES");
 const candidatos=[];
 for(const r of reportes)for(const h of r.hallazgos||[]){const regla=MAPA[h.tipo];if(regla)candidatos.push({reporte:r,hallazgo:h,regla});}
 candidatos.sort((a,b)=>(Number(b.hallazgo.impacto_financiero_estimado)||0)-(Number(a.hallazgo.impacto_financiero_estimado)||0)||(Number(b.hallazgo.confianza)||0)-(Number(a.hallazgo.confianza)||0));
 const usados=new Set(); const ordenes=[];
 for(const c of candidatos){if(usados.has(c.regla.departamento))continue;usados.add(c.regla.departamento);ordenes.push({departamento:c.regla.departamento,tarea:c.regla.tarea,prioridad:prioridad(c.reporte.kpi_principal.estado,Number(c.hallazgo.impacto_financiero_estimado)||0),responsableId:null,deadline:new Date(Date.now()+7*86400000),kpi_a_medir:c.regla.kpi,automatizable:false});}
 const criticos=reportes.filter(r=>r.kpi_principal.estado==="CRITICO");
 const confianza=Math.round(reportes.reduce((s,r)=>{const hs=r.hallazgos||[];return s+(hs.length?hs.reduce((x,h)=>x+Number(h.confianza||0),0)/hs.length:100);},0)/5);
 const principal=candidatos[0];
 return (await Decision.create({empresaId:new mongoose.Types.ObjectId(String(empresaId)),sedeId:null,decision_general:{situacion:criticos.length?`${criticos.length} funcion(es) critica(s) requieren atencion.`:"Revision empresarial consolidada disponible.",causa_raiz:principal?principal.hallazgo.evidencia:"No hay hallazgos accionables con los datos actuales.",prediccion:principal?"Sin correccion, el KPI asociado puede continuar fuera del objetivo.":"Mantener seguimiento de los cinco KPI principales."},ordenes_por_departamento:ordenes,confianza_global:Math.max(0,Math.min(100,confianza)),riesgo_si_no_se_hace:principal?principal.hallazgo.evidencia:"No se identifico riesgo cuantificado.",como_medir_exito_en_7_dias:ordenes.length?"Recalcular los KPI de las ordenes y comparar contra sus objetivos.":"Generar nuevamente los cinco reportes y verificar su estado.",reportesOrigen:reportes.map(r=>r._id),createdBy:null,deletedAt:null})).toObject();
}
module.exports={tomarDecision};
