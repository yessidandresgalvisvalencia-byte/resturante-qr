"use strict";
const interprete=require("./interpreteFinanciero.service");
const consulta=require("./consultaPersonal.service");
const master=require("./masterAsesorPersonal.service");
const simuladorMaster=require("./simuladorCuotasMaster.service");
const ContextoConversacional=require("../models/contextoConversacionalPersonal.model");
const TurnoConversacional=require("../models/turnoConversacionalPersonal.model");
function normalizar(s){return String(s||"").trim();}
function clasificar(texto){
 const t=normalizar(texto).toLowerCase();
 const pregunta=/\?|^(como|cómo|cuanto|cuánto|que|qué|puedo|deberia|debería|conviene|por que|por qué)\b/.test(t);
 const intencion=/\b(estoy pensando|pienso|quiero|quisiera|planeo|me ofrecieron|si compro|si saco|si pido|podria comprar|podría comprar|voy a comprar|quiero comprar|quiero viajar|quiero invertir)\b/.test(t);
 const hecho=/\b(gaste|gasté|compre|compré|pague|pagué|recibi|recibí|me pago|me pagó|me consigno|me consignó|me transfirio|me transfirió|me pagaron|gane|gané|abone|aboné|me prestaron|le preste|le presté|me debe|me deben|me quedo debiendo|me quedó debiendo)\b/.test(t);
 if(intencion)return"INTENCION";if(hecho&&!pregunta)return"HECHO";return"PREGUNTA";
}
async function procesar(usuarioId,{texto,canal="TEXTO"},{session}={}){
 const t=normalizar(texto);
 const simulacion=simuladorMaster.responder(t);if(simulacion)return simulacion;
 const ingresoMensual=require("./ingresoMensualConversacionalPersonal.service").proponer(t);if(ingresoMensual)return ingresoMensual;
 if(/(?:zapatos|tenis|calzado)/i.test(t)&&/(?:quiero|comprar|cuotas|financiar|inter[eé]s)/i.test(t)){await ContextoConversacional.findOneAndUpdate({usuarioId},{$set:{ultimaCompraPlanificada:{concepto:"zapatos",descripcion:t.slice(0,500),creadoEn:new Date()},asOf:new Date()}},{upsert:true,setDefaultsOnInsert:true,...(session?{session}:{})});}
 const historialQuery=TurnoConversacional.find({usuarioId}).sort({createdAt:-1}).limit(12).select("mensaje clase createdAt usuarioId");
 const historialReciente=await(session?historialQuery.session(session):historialQuery).lean();
 if(/^(?:de qu[eé] est[aá]bamos hablando|qu[eé] te dije antes)[?.! ]*$/i.test(t)){const anterior=historialReciente[0];return{clase:"PREGUNTA",requiereAprobacion:false,mensaje:anterior?"Tu último mensaje fue: «"+anterior.mensaje.slice(0,250)+"». ¿Quieres retomar ese tema?":"Aún no hay mensajes anteriores guardados para esta cuenta.",analisis:{soloLectura:true}};}
 const contextoQuery=ContextoConversacional.findOne({usuarioId}).select("ultimaCompraPlanificada");
 const contexto=await(session?contextoQuery.session(session):contextoQuery).lean();
 const compra=contexto?.ultimaCompraPlanificada&&Date.now()-new Date(contexto.ultimaCompraPlanificada.creadoEn).getTime()<7*86400000?contexto.ultimaCompraPlanificada:null;
 const respuestaPrecio=/^(?:valen|cuestan|cuesta|vale|son)?\s*\$?\s*\d[\d.,]*(?:\s*(?:mil|lucas?|palos?))?\s*(?:pesos)?$/i.test(t);
 if(compra&&/^(?:cancelar|olvida(?:r)? esa compra|ya no quiero comprar(?:los)?|no los voy a comprar)$/i.test(t)){await ContextoConversacional.updateOne({usuarioId},{$unset:{ultimaCompraPlanificada:""}},session?{session}:{});return{clase:"INTENCION",requiereAprobacion:false,mensaje:"Entendido. Dejamos de evaluar esa compra. No se registró ninguna deuda ni movimiento.",analisis:{soloLectura:true}};}
 if(compra&&/(?:no quiero afectar|mis obligaciones|me alcanza|puedo pagarlos)/i.test(t))return{clase:"INTENCION",requiereAprobacion:false,mensaje:"Tu prioridad es proteger tus obligaciones. No voy a recomendar financiar esta compra sin verificar cuánto dinero queda libre después de tus pagos esenciales y cuándo vence la primera cuota. ¿Qué fecha tendría el primer pago? No he registrado ninguna deuda.",analisis:{soloLectura:true}};
 if(compra&&respuestaPrecio)return{clase:"INTENCION",requiereAprobacion:false,mensaje:"🟡 Precio recibido para una compra en evaluación.\nLa referencia anterior no confirma método, cargos ni calendario.\nEnvía el escenario completo con precio, cuotas, porcentaje, método y cargos.\nNo se registró deuda ni pago y no hay capacidad evaluada.",analisis:{soloLectura:true,estado:"DATOS_PENDIENTES",simulacion:null,autorizaCredito:false}};
 const asesoria=/\b(mejor manera|mejor forma|me conviene|qu[eé] recomiendas|recomiendas|aconsejas|estrategia|plan de pago|c[oó]mo deber[ií]a|qu[eé] hago|ay[uú]dame a decidir)\b/i.test(t);
 const preguntaExplicita=/[?¿]/.test(t)||/^(?:cómo|como|cuánto|cuanto|qué|que|cuál|cual|por qué|por que|debería|deberia|puedo)\b/i.test(t);
 const interpretacionDeterministica=interprete.interpretarSegmento(t);
 const esHechoContable=interpretacionDeterministica&&interpretacionDeterministica.estado==="LISTO"&&interpretacionDeterministica.tipo!=="POR_CLASIFICAR";
 const consultaExplicita=/[?¿]/.test(t)||/^(?:cómo|como|cuánto|cuanto|qué|que|cuál|cual|por qué|por que|debería|deberia|puedo)\b/i.test(t);
 const clase=(asesoria||consultaExplicita)?"PREGUNTA":clasificar(texto)==="INTENCION"?"INTENCION":esHechoContable?"HECHO":clasificar(texto);
 if(clase==="HECHO"){const borrador=await interprete.crearBorrador(usuarioId,{texto,canal},{session});const incompletos=borrador.items.filter(x=>x.estado==="REQUIERE_REVISION"||!Number.isSafeInteger(x.montoMinor)||x.montoMinor<1);if(incompletos.length)return{clase:"VALIDACION",requiereAprobacion:false,mensaje:"Me falta el monto exacto. Dime cuánto fue exactamente; sin ese número te estaría mintiendo.",borrador};return{clase,requiereAprobacion:true,mensaje:"Listo, ya te pillé. Detecté "+borrador.items.length+" movimiento(s) con monto exacto. Revísalos y aprueba antes de afectar tus finanzas.",borrador};}
 if(clase==="INTENCION"){const resultado=await master.orientar(usuarioId,texto,{turnos:historialReciente,guardarContexto:!session});return{clase,requiereAprobacion:false,mensaje:resultado.tipo==="ACLARACION_CONTEXTO"?"Entiendo que estás considerando una decisión, no informando un movimiento realizado. Dime el objetivo, el plazo y el presupuesto para comparar opciones.":resultado.respuesta,analisis:resultado.datos};}
 const resultado=await master.orientar(usuarioId,texto,{turnos:historialReciente,guardarContexto:!session});return{clase,requiereAprobacion:false,mensaje:resultado.respuesta,analisis:resultado.datos};
}
module.exports={procesar,clasificar};
