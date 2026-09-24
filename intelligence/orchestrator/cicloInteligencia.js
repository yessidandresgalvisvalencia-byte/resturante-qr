"use strict";
const finanzas=require("../neurons/finanzas.neuron");
const ventas=require("../neurons/ventas.neuron");
const marketing=require("../neurons/marketing.neuron");
const operaciones=require("../neurons/operaciones.neuron");
const gente=require("../neurons/gente.neuron");
const cerebro=require("../brain/cerebro");
const NEURONAS=[finanzas,ventas,marketing,operaciones,gente];
async function ejecutarCicloEmpresa(empresaId){
 const reportes=[];
 for(const neurona of NEURONAS){reportes.push(await neurona.analyze(empresaId));}
 const requiere=reportes.some(r=>r.necesita_decision_de_cerebro||r.kpi_principal?.estado==="CRITICO");
 const decision=requiere?await cerebro.tomarDecision(empresaId):null;
 return {reportes,decision};
}
module.exports={ejecutarCicloEmpresa};
