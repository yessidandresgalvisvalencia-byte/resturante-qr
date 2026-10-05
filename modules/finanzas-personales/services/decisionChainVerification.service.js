"use strict";
const mongoose=require("mongoose");
const DecisionProof=require("../models/decisionProofPersonal.model");
const ChainHead=require("../models/decisionChainHeadPersonal.model");
const {verificar}=require("./decisionProof.service");
async function verificarCadena(usuarioId){
 if(!usuarioId)throw new TypeError("usuarioId obligatorio");
 const session=await mongoose.startSession();let resultado;
 try{
  await session.withTransaction(async()=>{
   const head=await ChainHead.findOne({usuarioId}).session(session).lean();
   const items=await DecisionProof.find({usuarioId}).session(session).sort({secuencia:1,createdAt:1,_id:1}).lean();
   if(!head){resultado={integra:false,estado:items.length?"CADENA_COMPROMETIDA":"SIN_CADENA",motivos:items.length?["CABEZA_AUSENTE"]:[]};return;}
   const motivos=[];
   if(head.secuencia!==items.length)motivos.push("SECUENCIA_INCONSISTENTE");
   let anterior=null;
   for(let i=0;i<items.length;i++){
    const item=items[i];
    if(!verificar(item)){motivos.push("HASH_INVALIDO");break;}
    if((item.previousHash||null)!==anterior){motivos.push("ENLACE_INVALIDO");break;}
    if(item.version===2&&item.secuencia!==i+1){motivos.push("ORDEN_INVALIDO");break;}
    anterior=item.hash;
   }
   if((head.headHash||null)!==(anterior||null))motivos.push("CABEZA_INCONSISTENTE");
   resultado={integra:motivos.length===0,estado:motivos.length?"CADENA_COMPROMETIDA":"INTEGRA",motivos,secuencia:head.secuencia,headHash:head.headHash||null};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return resultado;
 }finally{await session.endSession();}
}
module.exports={verificarCadena};
