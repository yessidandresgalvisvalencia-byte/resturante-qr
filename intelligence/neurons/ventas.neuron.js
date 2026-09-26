"use strict";
const mongoose = require("mongoose");
const Empresa = require("../../models/Empresa");
const Venta = require("../../models/Venta");
const CerebroReporteNeurona = require("../models/CerebroReporteNeurona");
const NEURONA = "VENTAS";
function getRequiredEvents(){ return ["VENTA_COMPLETADA"]; }
function periodo(){ const a=new Date(); return {desde:new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1)),hasta:new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,1))}; }
async function analyze(empresaId){
 if(!mongoose.Types.ObjectId.isValid(empresaId)) throw new Error("VENTAS_NEURON_EMPRESA_ID_INVALIDO");
 const empresa=await Empresa.findById(empresaId).select("_id configuracion.ticket_objetivo").lean();
 if(!empresa) throw new Error("VENTAS_NEURON_EMPRESA_NO_ENCONTRADA");
 const {desde,hasta}=periodo();
 const [r]=await Venta.aggregate([{$match:{empresaId:new mongoose.Types.ObjectId(String(empresaId)),estado:"pagada",fecha:{$gte:desde,$lt:hasta}}},{$group:{_id:null,ventas:{$sum:1},ingresos:{$sum:"$total"}}}]);
 const ventas=r?.ventas||0, ingresos=r?.ingresos||0, actual=ventas?ingresos/ventas:null;
 const cfg=empresa.configuracion?.ticket_objetivo; const objetivo=cfg==null?null:Number(cfg);
 let estado="ALERTA"; if(actual!=null&&objetivo!=null) estado=actual>=objetivo?"OK":actual<objetivo*0.8?"CRITICO":"ALERTA";
 const hallazgos=[];
 if(objetivo==null) hallazgos.push({tipo:"CONFIGURACION_INCOMPLETA",evidencia:"La empresa no tiene ticket objetivo configurado.",impacto_financiero_estimado:0,confianza:100});
 if(!ventas) hallazgos.push({tipo:"SIN_VENTAS_EN_PERIODO",evidencia:"No existen ventas pagadas en el periodo analizado.",impacto_financiero_estimado:0,confianza:100});
 if(actual!=null&&objetivo!=null&&actual<objetivo) hallazgos.push({tipo:"TICKET_BAJO_OBJETIVO",evidencia:`Ticket promedio ${actual.toFixed(2)}, objetivo ${objetivo.toFixed(2)}.`,impacto_financiero_estimado:Math.max(0,(objetivo-actual)*ventas),confianza:100});
 const evaluable=actual!=null&&objetivo!=null;
 const doc=await CerebroReporteNeurona.create({neurona:NEURONA,empresaId:empresa._id,sedeId:null,periodo:{desde,hasta},timestamp:new Date(),kpi_principal:{nombre:"ticket_promedio",valor_actual:actual,valor_objetivo:objetivo,estado,medicion_disponible:actual!=null,objetivo_disponible:objetivo!=null,motivo_no_evaluable:objetivo==null?"Falta configurar ticket objetivo.":actual==null?"No existen ventas pagadas suficientes para evaluar ticket promedio.":""},hallazgos,necesita_decision_de_cerebro:evaluable&&estado!=="OK",createdBy:null,deletedAt:null});
 return doc.toObject();
}
module.exports={getRequiredEvents,analyze};
