"use strict";
const interprete=require("./interpreteFinanciero.service");
const consulta=require("./consultaPersonal.service");
const home=require("./homePersonal.service");
function normalizar(s){return String(s||"").trim();}
function clasificar(texto){
 const t=normalizar(texto).toLowerCase();
 const pregunta=/\?|^(como|cómo|cuanto|cuánto|que|qué|puedo|deberia|debería|conviene|por que|por qué)\b/.test(t);
 const intencion=/\b(estoy pensando|pienso|quiero|quisiera|planeo|me ofrecieron|si compro|si saco|si pido|podria comprar|podría comprar|voy a comprar|quiero comprar|quiero viajar|quiero invertir)\b/.test(t);
 const hecho=/\b(gaste|gasté|compre|compré|pague|pagué|recibi|recibí|me pagaron|gane|gané|abone|aboné|me prestaron|le preste|le presté)\b/.test(t);
 if(intencion)return"INTENCION";if(hecho&&!pregunta)return"HECHO";return"PREGUNTA";
}
async function procesar(usuarioId,{texto,canal="TEXTO"}){
 const clase=clasificar(texto);
 if(clase==="HECHO"){const borrador=await interprete.crearBorrador(usuarioId,{texto,canal});return{clase,requiereAprobacion:true,mensaje:"Detecté un hecho financiero. Lo estructuré, pero no modificaré tus finanzas hasta que lo apruebes.",borrador};}
 const estado=await home.obtener(usuarioId);
 if(clase==="INTENCION")return{clase,requiereAprobacion:false,mensaje:"Lo traté como una intención: no registré ningún gasto ni deuda.",analisis:{disponibleDespuesCompromisosMinor:estado.caja.disponibleDespuesCompromisosMinor,flujoMesMinor:estado.mes.flujoMinor,deudaTotalMinor:estado.patrimonio.deudaTotalMinor,proximaObligacion:estado.proximaObligacion,criterio:"GRUK preserva el ledger: una intención se simula y nunca se contabiliza sin confirmación explícita."}};
 const resultado=await consulta.consultar(usuarioId,texto);return{clase,requiereAprobacion:false,mensaje:resultado.respuesta,analisis:resultado.datos};
}
module.exports={procesar,clasificar};
