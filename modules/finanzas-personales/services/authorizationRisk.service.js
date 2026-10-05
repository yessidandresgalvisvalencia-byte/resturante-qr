"use strict";
const IRREVERSIBLES=new Set(["PAGAR","TRANSFERIR","INVERTIR","ENDEUDARSE","REFINANCIAR","DEBITAR","COBRAR_AUTOMATICO"]);
const REVERSIBLES=new Set(["SIMULAR","CONSULTAR"]);
const POLITICAS=Object.freeze({PAGAR:["SALDO_ORIGEN","MONTO","DESTINO"],TRANSFERIR:["SALDO_ORIGEN","MONTO","DESTINO"],INVERTIR:["SALDO_ORIGEN","MONTO","INSTRUMENTO","RIESGO"],ENDEUDARSE:["MONTO","ACREEDOR","CONDICIONES"],REFINANCIAR:["DEUDA_ORIGEN","SALDO_DEUDA","CONDICIONES"],DEBITAR:["SALDO_ORIGEN","MONTO","DESTINO"],COBRAR_AUTOMATICO:["MONTO","MANDATO","DESTINO"]});
function evaluar({accion,verdades=[],aprobacionExplicita=false,idempotencyKey=null,integridadCadena=null,evidenciasRequeridas=[],contexto={}}){
 if(typeof accion!=="string"||!accion.trim())throw new TypeError("Acción obligatoria");
 if(!Array.isArray(verdades))throw new TypeError("Verdades debe ser una lista");
 if(!Array.isArray(evidenciasRequeridas))throw new TypeError("evidenciasRequeridas debe ser una lista");
 if(!contexto||typeof contexto!=="object"||Array.isArray(contexto))throw new TypeError("contexto debe ser un objeto");
 const normalizada=accion.trim().toUpperCase();
 if(!IRREVERSIBLES.has(normalizada)&&!REVERSIBLES.has(normalizada))return{autorizada:false,irreversible:true,motivos:["ACCION_NO_CLASIFICADA"]};
 const irreversible=IRREVERSIBLES.has(normalizada);
 if(!irreversible)return{autorizada:true,irreversible:false,motivos:[]};
 const motivos=[];
 if(!integridadCadena||integridadCadena.integra!==true||integridadCadena.estado!=="INTEGRA")motivos.push("CADENA_DECISIONES_NO_INTEGRA");
 if(!aprobacionExplicita)motivos.push("REQUIERE_APROBACION_EXPLICITA");
 if(typeof idempotencyKey!=="string"||idempotencyKey.trim().length<8)motivos.push("REQUIERE_IDEMPOTENCIA");
 const hechos=verdades.filter(v=>v&&v.tipo==="HECHO"&&v.confianza==="VERIFICADO"&&!v.requiereReconciliacion);
 const requisitos=[...new Set([...(POLITICAS[normalizada]||[]),...evidenciasRequeridas])];
 for(const requisito of requisitos){const candidatos=hechos.filter(v=>v.evidenciaTipo===requisito);if(!candidatos.length){motivos.push("FALTA_EVIDENCIA_"+String(requisito).toUpperCase());continue;}const esperados=contexto[requisito]||{};const vinculada=candidatos.some(v=>Object.entries(esperados).every(([k,val])=>String(v[k])===String(val)));if(!vinculada)motivos.push("EVIDENCIA_NO_VINCULADA_"+String(requisito).toUpperCase());}
 if(!hechos.length)motivos.push("REQUIERE_HECHO_RECONCILIADO");
 if(verdades.some(v=>v&&["INFERENCIA","PROYECCION"].includes(v.tipo)&&v.requiereReconciliacion))motivos.push("DATOS_PENDIENTES_RECONCILIACION");
 return{autorizada:motivos.length===0,irreversible:true,motivos};
}
module.exports={IRREVERSIBLES,REVERSIBLES,POLITICAS,evaluar};
