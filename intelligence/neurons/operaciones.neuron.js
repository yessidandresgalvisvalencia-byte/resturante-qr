"use strict";
const mongoose=require("mongoose");
const Inventario=require("../../models/Inventario");
const CerebroReporteNeurona=require("../models/CerebroReporteNeurona");
const NEURONA="OPERACIONES";
function getRequiredEvents(){return [];}
function periodo(){const a=new Date();return {desde:new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1)),hasta:new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,1))};}
async function analyze(empresaId){
 if(!mongoose.Types.ObjectId.isValid(empresaId)) throw new Error("OPERACIONES_NEURON_EMPRESA_ID_INVALIDO");
 const empresaObjectId=new mongoose.Types.ObjectId(String(empresaId)); const {desde,hasta}=periodo();
 const [total,agotados]=await Promise.all([Inventario.countDocuments({empresaId:empresaObjectId,anulado:false}),Inventario.countDocuments({empresaId:empresaObjectId,anulado:false,$or:[{estado:"agotado"},{cantidad:{$lte:0}}]})]);
 const porcentaje=total?(agotados/total)*100:0; const estado=agotados===0?"OK":porcentaje>=20?"CRITICO":"ALERTA";
 const hallazgos=[]; if(!total) hallazgos.push({tipo:"SIN_INVENTARIO_CONFIGURADO",evidencia:"No existen items de inventario activos para medir disponibilidad.",impacto_financiero_estimado:0,confianza:100});
 if(agotados) hallazgos.push({tipo:"INVENTARIO_AGOTADO",evidencia:`${agotados} de ${total} item(s) de inventario estan agotados.`,impacto_financiero_estimado:0,confianza:100});
 const doc=await CerebroReporteNeurona.create({neurona:NEURONA,empresaId:empresaObjectId,sedeId:null,periodo:{desde,hasta},timestamp:new Date(),kpi_principal:{nombre:"porcentaje_items_agotados",valor_actual:Number(porcentaje.toFixed(2)),valor_objetivo:0,estado},hallazgos,necesita_decision_de_cerebro:estado!=="OK",createdBy:null,deletedAt:null}); return doc.toObject();
}
module.exports={getRequiredEvents,analyze};
