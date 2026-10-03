"use strict";
const interprete=require("./interpreteFinanciero.service");
const consulta=require("./consultaPersonal.service");
const home=require("./homePersonal.service");
const Transaccion=require("../models/TransaccionPersonal");
function normalizar(s){return String(s||"").trim();}
function clasificar(texto){
 const t=normalizar(texto).toLowerCase();
 const pregunta=/\?|^(como|cómo|cuanto|cuánto|que|qué|puedo|deberia|debería|conviene|por que|por qué)\b/.test(t);
 const intencion=/\b(estoy pensando|pienso|quiero|quisiera|planeo|me ofrecieron|si compro|si saco|si pido|podria comprar|podría comprar|voy a comprar|quiero comprar|quiero viajar|quiero invertir)\b/.test(t);
 const hecho=/\b(gaste|gasté|compre|compré|pague|pagué|recibi|recibí|me pagaron|gane|gané|abone|aboné|me prestaron|le preste|le presté|me debe|me deben|me quedo debiendo|me quedó debiendo)\b/.test(t);
 if(intencion)return"INTENCION";if(hecho&&!pregunta)return"HECHO";return"PREGUNTA";
}
async function procesar(usuarioId,{texto,canal="TEXTO"}){
 const t=normalizar(texto);
 const patronIngreso=t.match(/(?:me\s+(?:pagan|consignan|depositan)|recibo|cobro)(?:\s+el)?\s+(?:d[ií]a\s+)?(\d{1,2})\s+(?:de\s+)?cada\s+mes|(?:me\s+(?:pagan|consignan|depositan)|recibo|cobro)\s+(?:cada\s+mes\s+)?(?:el\s+)?(?:d[ií]a\s+)?(\d{1,2})/i);
 if(patronIngreso){
  const dia=Number(patronIngreso[1]||patronIngreso[2]);if(dia<1||dia>31)return{clase:"VALIDACION",requiereAprobacion:false,mensaje:"Ese día del mes no es válido."};
  const prev=await Transaccion.findOne({usuarioId,tipo:"INGRESO",estado:{$ne:"ANULADA"}}).sort({fecha:-1}).lean();
  if(!prev)return{clase:"VALIDACION",requiereAprobacion:false,mensaje:"Ya entendí que recibes dinero el día "+dia+" de cada mes, pero todavía no tengo un ingreso registrado al cual asociar ese patrón. Registra el ingreso exacto una vez y desde ahí lo recordaré."};
  const base=new Date();let y=base.getFullYear(),m=base.getMonth();if(base.getDate()>=dia){m++;if(m>11){m=0;y++;}}const fecha=new Date(y,m,Math.min(dia,new Date(y,m+1,0).getDate()),12,0,0,0);
  await Transaccion.updateOne({_id:prev._id,usuarioId},{$set:{recurrente:true,frecuencia:"MENSUAL"}});
  return{clase:"CONFIGURACION",requiereAprobacion:false,mensaje:"Listo. Guardé que tu ingreso registrado es mensual y llega el día "+dia+". Tu próximo ingreso será el "+fecha.toLocaleDateString("es-CO",{timeZone:"America/Bogota"})+". Desde ahora GRUK usará ese patrón para calcular Disponible Hoy.",analisis:{diaIngreso:dia,proximoIngreso:fecha,montoMinor:prev.montoMinor}};
 }
 const clase=clasificar(texto);
 if(clase==="HECHO"){const borrador=await interprete.crearBorrador(usuarioId,{texto,canal});const incompletos=borrador.items.filter(x=>x.estado==="REQUIERE_REVISION"||!Number.isSafeInteger(x.montoMinor)||x.montoMinor<1);if(incompletos.length)return{clase:"VALIDACION",requiereAprobacion:false,mensaje:"Me falta el monto exacto. Dime cuánto fue exactamente; sin ese número te estaría mintiendo.",borrador};return{clase,requiereAprobacion:true,mensaje:"Listo, ya te pillé. Detecté "+borrador.items.length+" movimiento(s) con monto exacto. Revísalos y aprueba antes de afectar tus finanzas.",borrador};}
 const estado=await home.obtener(usuarioId);
 if(clase==="INTENCION")return{clase,requiereAprobacion:false,mensaje:"Lo traté como una intención: no registré ningún gasto ni deuda.",analisis:{disponibleDespuesCompromisosMinor:estado.caja.disponibleDespuesCompromisosMinor,flujoMesMinor:estado.mes.flujoMinor,deudaTotalMinor:estado.patrimonio.deudaTotalMinor,proximaObligacion:estado.proximaObligacion,criterio:"GRUK preserva el ledger: una intención se simula y nunca se contabiliza sin confirmación explícita."}};
 const resultado=await consulta.consultar(usuarioId,texto);return{clase,requiereAprobacion:false,mensaje:resultado.respuesta,analisis:resultado.datos};
}
module.exports={procesar,clasificar};
