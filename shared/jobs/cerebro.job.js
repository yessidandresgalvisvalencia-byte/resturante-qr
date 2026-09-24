"use strict";
const cron=require("node-cron");
const Empresa=require("../../models/Empresa");
const {ejecutarCicloEmpresa}=require("../../intelligence/orchestrator/cicloInteligencia");
let iniciado=false;
function iniciarCerebroJob(){
 if(iniciado)return; iniciado=true;
 cron.schedule("0 */3 * * *",async()=>{
  try{
   const empresas=await Empresa.find({estado:"activa","modulos.inteligencia":true}).select("_id").lean();
   for(const empresa of empresas){
    try{await ejecutarCicloEmpresa(empresa._id,{forzarDecision:true});}
    catch(error){console.error("[GRUK CEREBRO] ciclo empresa fallo",{empresaId:String(empresa._id),error:error.message});}
   }
  }catch(error){console.error("[GRUK CEREBRO] job fallo",error);}
 });
}
module.exports=iniciarCerebroJob;
