"use strict";
const DecisionProof=require("../models/decisionProofPersonal.model");
const ChainHead=require("../models/decisionChainHeadPersonal.model");
const {verificar}=require("./decisionProof.service");
async function verificarCadena(usuarioId){
 if(!usuarioId)throw new TypeError("usuarioId obligatorio");
 const [head,items]=await Promise.all([
  ChainHead.findOne({usuarioId}).lean(),
  DecisionProof.find({usuarioId}).sort({createdAt:1,_id:1}).lean()
 ]);
 if(!head)return{integra:items.length===0,estado:items.length?"CADENA_COMPROMETIDA":"SIN_CADENA",motivos:items.length?["CABEZA_AUSENTE"]:[]};
 const motivos=[];
 if(head.secuencia!==items.length)motivos.push("SECUENCIA_INCONSISTENTE");
 let anterior=null;
 for(const item of items){
  if(!verificar(item)){motivos.push("HASH_INVALIDO");break;}
  if((item.previousHash||null)!==anterior){motivos.push("ENLACE_INVALIDO");break;}
  anterior=item.hash;
 }
 if((head.headHash||null)!==(anterior||null))motivos.push("CABEZA_INCONSISTENTE");
 return{integra:motivos.length===0,estado:motivos.length?"CADENA_COMPROMETIDA":"INTEGRA",motivos,secuencia:head.secuencia,headHash:head.headHash||null};
}
module.exports={verificarCadena};
