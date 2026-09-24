"use strict";
const mongoose=require("mongoose");
const Empresa=require("../../models/Empresa");
const CerebroReporteNeurona=require("../models/CerebroReporteNeurona");
const NEURONA="GENTE";
function getRequiredEvents(){return [];}
function periodo(){const a=new Date();return {desde:new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1)),hasta:new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,1))};}
async function analyze(empresaId){
 if(!mongoose.Types.ObjectId.isValid(empresaId)) throw new Error("GENTE_NEURON_EMPRESA_ID_INVALIDO");
 const empresa=await Empresa.findById(empresaId).select("_id configuracion.empleados_actuales").lean(); if(!empresa) throw new Error("GENTE_NEURON_EMPRESA_NO_ENCONTRADA");
 const {desde,hasta}=periodo(); const cfg=empresa.configuracion?.empleados_actuales; const empleados=cfg==null?null:Number(cfg);
 const hallazgos=[]; let estado="OK";
 if(empleados==null){estado="ALERTA";hallazgos.push({tipo:"CONFIGURACION_INCOMPLETA",evidencia:"La empresa no tiene empleados actuales configurados.",impacto_financiero_estimado:0,confianza:100});}
 const doc=await CerebroReporteNeurona.create({neurona:NEURONA,empresaId:empresa._id,sedeId:null,periodo:{desde,hasta},timestamp:new Date(),kpi_principal:{nombre:"empleados_actuales",valor_actual:empleados,valor_objetivo:15,estado},hallazgos,necesita_decision_de_cerebro:estado!=="OK",createdBy:null,deletedAt:null});return doc.toObject();
}
module.exports={getRequiredEvents,analyze};
