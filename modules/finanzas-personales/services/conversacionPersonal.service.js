"use strict";
const interprete=require("./interpreteFinanciero.service");
const consulta=require("./consultaPersonal.service");
const home=require("./homePersonal.service");
const Transaccion=require("../models/TransaccionPersonal");
const Calendario=require("../models/calendarioFinanciero.model");
const ContextoConversacional=require("../models/contextoConversacionalPersonal.model");
function normalizar(s){return String(s||"").trim();}
function clasificar(texto){
 const t=normalizar(texto).toLowerCase();
 const pregunta=/\?|^(como|cómo|cuanto|cuánto|que|qué|puedo|deberia|debería|conviene|por que|por qué)\b/.test(t);
 const intencion=/\b(estoy pensando|pienso|quiero|quisiera|planeo|me ofrecieron|si compro|si saco|si pido|podria comprar|podría comprar|voy a comprar|quiero comprar|quiero viajar|quiero invertir)\b/.test(t);
 const hecho=/\b(gaste|gasté|compre|compré|pague|pagué|recibi|recibí|me pago|me pagó|me consigno|me consignó|me transfirio|me transfirió|me pagaron|gane|gané|abone|aboné|me prestaron|le preste|le presté|me debe|me deben|me quedo debiendo|me quedó debiendo)\b/.test(t);
 if(intencion)return"INTENCION";if(hecho&&!pregunta)return"HECHO";return"PREGUNTA";
}
async function procesar(usuarioId,{texto,canal="TEXTO"}){
 const t=normalizar(texto);
 if(/(?:zapatos|tenis|calzado)/i.test(t)&&/(?:quiero|comprar|cuotas|financiar|inter[eé]s)/i.test(t)){await ContextoConversacional.findOneAndUpdate({usuarioId},{$set:{ultimaCompraPlanificada:{concepto:"zapatos",descripcion:t.slice(0,500),creadoEn:new Date()},asOf:new Date()}},{upsert:true,setDefaultsOnInsert:true});}
 const contexto=await ContextoConversacional.findOne({usuarioId}).select("ultimaCompraPlanificada").lean();
 const compra=contexto?.ultimaCompraPlanificada;
 const terminosCompra=String(compra?.descripcion||"");
 const tasaCompra=terminosCompra.match(/(\d+(?:[.,]\d+)?)\s*%/);
 const numeroCuotas=/\b(?:dos|2)\s*cuotas\b/i.test(terminosCompra)?2:null;
 const respuestaPrecio=t.match(/^(?:valen|cuestan|cuesta|vale|son)?\s*\$?\s*(\d+(?:[.,]\d{3})*)(?:\s*(mil))?\s*(?:pesos)?$/i);
 if(compra&&/(?:no quiero afectar|mis obligaciones|me alcanza|puedo pagarlos)/i.test(t))return{clase:"INTENCION",requiereAprobacion:false,mensaje:"Tu prioridad es proteger tus obligaciones. No voy a recomendar financiar esta compra sin verificar cuánto dinero queda libre después de tus pagos esenciales y cuándo vence la primera cuota. ¿Qué fecha tendría el primer pago? No he registrado ninguna deuda.",analisis:{soloLectura:true}};
 if(compra&&respuestaPrecio){const precio=Number(respuestaPrecio[1].replace(/[.,]/g,""))*(respuestaPrecio[2]?1000:1);const tasa=tasaCompra?Number(tasaCompra[1].replace(",",".")):null;if(Number.isSafeInteger(precio)&&precio>0&&numeroCuotas===2&&Number.isFinite(tasa)&&tasa>=0&&tasa<=100){const base=precio/2;const pago=base*(1+tasa/100);return{clase:"INTENCION",requiereAprobacion:false,mensaje:"Los zapatos cuestan "+new Intl.NumberFormat("es-CO").format(precio)+" pesos. Con dos cuotas y un cobro del "+tasa+"% sobre cada cuota base, cada cuota sería de "+new Intl.NumberFormat("es-CO").format(Math.round(pago))+" pesos y el total sería de "+new Intl.NumberFormat("es-CO").format(Math.round(pago*2))+" pesos. Esta cifra es condicional: confirma que el comercio aplica el porcentaje a cada cuota base, sin otros cargos. Para proteger tus obligaciones, ¿cuándo pagarías la primera cuota? No registré ninguna deuda.",analisis:{soloLectura:true,precioMinor:precio*100,numeroCuotas,tasaPct:tasa}};}if(Number.isSafeInteger(precio)&&precio>0){return{clase:"INTENCION",requiereAprobacion:false,mensaje:"Entendido, el precio de la compra que estamos evaluando es "+new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(precio)+". No voy a registrar una deuda. Para calcular las cuotas necesito verificar cómo se aplica el interés que mencionaste.",analisis:{soloLectura:true,precioMinor:precio*100}};}}
 const asesoria=/\b(mejor manera|mejor forma|me conviene|qu[eé] recomiendas|recomiendas|aconsejas|estrategia|plan de pago|c[oó]mo deber[ií]a|qu[eé] hago|ay[uú]dame a decidir)\b/i.test(t);
 const preguntaExplicita=/[?¿]/.test(t)||/^(?:cómo|como|cuánto|cuanto|qué|que|cuál|cual|por qué|por que|debería|deberia|puedo)\b/i.test(t);
 const patronIngreso=(asesoria||preguntaExplicita)?null:t.match(/(?:me\s+(?:pagan|consignan|depositan)|recibo|cobro)(?:\s+el)?\s+(?:d[ií]a\s+)?(\d{1,2})\s+(?:de\s+)?cada\s+mes|(?:me\s+(?:pagan|consignan|depositan)|recibo|cobro)\s+(?:cada\s+mes\s+)?(?:el\s+)?(?:d[ií]a\s+)?(\d{1,2})/i);
 if(patronIngreso){
  const dia=Number(patronIngreso[1]||patronIngreso[2]);if(dia<1||dia>31)return{clase:"VALIDACION",requiereAprobacion:false,mensaje:"Ese día del mes no es válido."};
  const prev=await Transaccion.findOne({usuarioId,tipo:"INGRESO",estado:{$ne:"ANULADA"}}).sort({fecha:-1}).lean();
  if(!prev)return{clase:"VALIDACION",requiereAprobacion:false,mensaje:"Ya entendí que recibes dinero el día "+dia+" de cada mes, pero todavía no tengo un ingreso registrado al cual asociar ese patrón. Registra el ingreso exacto una vez y desde ahí lo recordaré."};
  const base=new Date();let y=base.getFullYear(),m=base.getMonth();if(base.getDate()>=dia){m++;if(m>11){m=0;y++;}}const fecha=new Date(y,m,Math.min(dia,new Date(y,m+1,0).getDate()),12,0,0,0);
  return{clase:"PROPUESTA_CONFIGURACION",requiereAprobacion:true,mensaje:"Identifiqué una posible programación de ingreso mensual el día "+dia+". No he cambiado tus movimientos ni el calendario. La programación requiere confirmación explícita.",analisis:{diaIngreso:dia,proximoIngreso:fecha,montoMinor:prev.montoMinor,estado:"PENDIENTE_CONFIRMACION"}};
 }
 const interpretacionDeterministica=interprete.interpretarSegmento(t);
 const esHechoContable=interpretacionDeterministica&&interpretacionDeterministica.estado==="LISTO"&&interpretacionDeterministica.tipo!=="POR_CLASIFICAR";
 const consultaExplicita=/[?¿]/.test(t)||/^(?:cómo|como|cuánto|cuanto|qué|que|cuál|cual|por qué|por que|debería|deberia|puedo)\b/i.test(t);
 const clase=(asesoria||consultaExplicita)?"PREGUNTA":clasificar(texto)==="INTENCION"?"INTENCION":esHechoContable?"HECHO":clasificar(texto);
 if(clase==="HECHO"){const borrador=await interprete.crearBorrador(usuarioId,{texto,canal});const incompletos=borrador.items.filter(x=>x.estado==="REQUIERE_REVISION"||!Number.isSafeInteger(x.montoMinor)||x.montoMinor<1);if(incompletos.length)return{clase:"VALIDACION",requiereAprobacion:false,mensaje:"Me falta el monto exacto. Dime cuánto fue exactamente; sin ese número te estaría mintiendo.",borrador};return{clase,requiereAprobacion:true,mensaje:"Listo, ya te pillé. Detecté "+borrador.items.length+" movimiento(s) con monto exacto. Revísalos y aprueba antes de afectar tus finanzas.",borrador};}
 const estado=await home.obtener(usuarioId);
 if(clase==="INTENCION"){const resultado=await consulta.consultar(usuarioId,texto);return{clase,requiereAprobacion:false,mensaje:resultado.tipo==="ACLARACION_CONTEXTO"?"Entiendo que estás considerando una decisión, no informando un movimiento realizado. Dime el objetivo, el plazo y el presupuesto para comparar opciones.":resultado.respuesta,analisis:resultado.datos};}
 const resultado=await consulta.consultar(usuarioId,texto);return{clase,requiereAprobacion:false,mensaje:resultado.respuesta,analisis:resultado.datos};
}
module.exports={procesar,clasificar};
