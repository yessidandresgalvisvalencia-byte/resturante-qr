"use strict";
const IRREVERSIBLES=new Set(["PAGAR","TRANSFERIR","INVERTIR","ENDEUDARSE","REFINANCIAR","DEBITAR","COBRAR_AUTOMATICO"]);
function evaluar({accion,verdades=[],aprobacionExplicita=false,idempotencyKey=null}){
 if(typeof accion!=="string"||!accion.trim())throw new TypeError("Acción obligatoria");
 if(!Array.isArray(verdades))throw new TypeError("Verdades debe ser una lista");
 const irreversible=IRREVERSIBLES.has(accion);
 if(!irreversible)return{autorizada:true,irreversible:false,motivos:[]};
 const motivos=[];
 if(!aprobacionExplicita)motivos.push("REQUIERE_APROBACION_EXPLICITA");
 if(typeof idempotencyKey!=="string"||idempotencyKey.trim().length<8)motivos.push("REQUIERE_IDEMPOTENCIA");
 const hechos=verdades.filter(v=>v&&v.tipo==="HECHO"&&v.confianza==="VERIFICADO"&&!v.requiereReconciliacion);
 if(!hechos.length)motivos.push("REQUIERE_HECHO_RECONCILIADO");
 if(verdades.some(v=>v&&["INFERENCIA","PROYECCION"].includes(v.tipo)&&v.requiereReconciliacion))motivos.push("DATOS_PENDIENTES_RECONCILIACION");
 return{autorizada:motivos.length===0,irreversible:true,motivos};
}
module.exports={IRREVERSIBLES,evaluar};
