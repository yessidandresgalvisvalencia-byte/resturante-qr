"use strict";
const Turno=require("../models/turnoConversacionalPersonal.model");
const Contexto=require("../models/contextoConversacionalPersonal.model");
const home=require("./homePersonal.service");
const consulta=require("./consultaPersonal.service");
const proyeccion=require("./proyeccionMaster90d.service");

const NORMALIZAR=s=>String(s||"").trim();
const SEGUIMIENTO=/^(?:¿?\s*(?:y si|entonces|en ese caso|con eso|y con eso|qué pasaría si|que pasaria si|en vez de|mejor|pero si|cuánto sería|cuanto seria|por qué|por que|explícame|explicame|y si no))\b/i;
const DECISION=/(?:conviene|recomiendas|aconsejas|deber[ií]a|ser[ií]a mejor|qu[eé] hago|qu[eé] har[ií]as|me alcanza|puedo pagar|podr[ií]a pagar|vale la pena)/i;
function seguimiento(texto){return SEGUIMIENTO.test(NORMALIZAR(texto));}
function encontrarContexto(turnos,texto){
 if(!seguimiento(texto))return null;
 const candidatos=turnos.filter(t=>t&&typeof t.mensaje==="string"&&t.mensaje.trim()&&t.mensaje.trim()!==texto);
 return candidatos[0]||null;
}
function moneda(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n));}
function estadoConocido(h){
 const a=h?.asesor||{},saldoConocido=Boolean(a.saldoRealConocido);
 const disponible=saldoConocido&&Number.isSafeInteger(a.disponibleHoyMinor)?a.disponibleHoyMinor:null;
 const compromisos=Number.isSafeInteger(h?.caja?.comprometidoMinor)?h.caja.comprometidoMinor:null;
 return{saldoConocido,disponible,compromisos,confiabilidad:a.saldoConfiabilidad||"NO_VERIFICADO"};
}
function armarRespuesta(base,datos){
 const hechos=datos.saldoConocido?
  "Disponible estimado para gasto libre: "+moneda(datos.disponible)+".":"No hay saldo disponible verificado suficiente para afirmar cuánto puedes comprometer.";
 const compromisos=datos.compromisos===null?"Los compromisos pendientes no están completamente cuantificados.":"Compromisos registrados: "+moneda(datos.compromisos)+".";
 const riesgo=datos.confiabilidad==="VERIFICADO"?"Datos de saldo verificados en GRUK.":"El saldo necesita conciliación; las cifras no deben tratarse como dinero confirmado.";
 return base+"\n\n**Situación financiera conocida:** "+hechos+" "+compromisos+" "+riesgo+
 "\n\n**Criterio profesional:** Antes de asumir un gasto o una cuota nueva, protege alimentación, vivienda, transporte, pagos próximos y un margen para imprevistos. Si faltan precio final, intereses, fechas o gastos esenciales, no es responsable aprobar la decisión con certeza."+
 "\n\n**Siguiente decisión:** Compara el costo total y el calendario de pagos con tu dinero realmente disponible. No se creó ningún movimiento, préstamo ni compromiso.";
}
async function orientar(usuarioId,pregunta,{turnos=[]}={}){
 const actual=NORMALIZAR(pregunta);
 const anterior=encontrarContexto(turnos,actual);
 const contextoPrevio=anterior?.mensaje?.slice(0,400)||null;
 if(/(?:proyecci[oó]n|proyecta|pr[oó]ximos? (?:30|60|90) d[ií]as|(?:30|60|90) d[ií]as|futuro de mi caja)/i.test(actual)&&/(?:caja|finanzas|dinero|saldo|ingresos|gastos|pagos|proyecci[oó]n|proyecta)/i.test(actual)){
  const resultado=await proyeccion.analizar(usuarioId);
  const partes=resultado.ventanas.map(v=>v.dias+" días: ingresos con fecha "+moneda(v.ingresosConFechaMinor)+", compromisos identificados "+moneda(v.obligacionesConFechaMinor)+", saldo condicional "+(v.saldoCondicionalMinor===null?"no verificable":moneda(v.saldoCondicionalMinor))+".");
  return{tipo:"PROYECCION_PARCIAL_30_60_90",respuesta:"Proyección parcial basada únicamente en eventos conocidos, no un presupuesto completo. "+partes.join(" ")+" Faltan gastos futuros y posiblemente ingresos recurrentes; esos importes no se han inventado. La cobertura actual de compromisos se limita a los registrados antes del próximo ingreso conocido. No he registrado ni programado movimientos.",datos:resultado};
 }
 const consultaBase=await consulta.consultar(usuarioId,actual);
 const solicitaDecision=DECISION.test(actual);
 if(!solicitaDecision&&!anterior)return{...consultaBase,contextoPrevio:null};
 const h=await home.obtener(usuarioId),e=estadoConocido(h);
 const prefijo=anterior?
  "Sigo el tema de tu pregunta anterior («"+contextoPrevio+"»), pero no asumiré que esa operación ocurrió ni que sus condiciones siguen vigentes. "+
  "Tu pregunta actual es «"+actual+"». ":"";
 return{
  ...consultaBase,
  tipo:"ASESORIA_MASTER_CONTEXTO",
  respuesta:prefijo+armarRespuesta(consultaBase.respuesta,e),
  datos:{...(consultaBase.datos||{}),soloLectura:true,contextoPrevio:contextoPrevio?{texto:contextoPrevio}:null,calidadSaldo:e.confiabilidad,requiereAprobacion:false}
 };
}
module.exports={seguimiento,encontrarContexto,estadoConocido,armarRespuesta,orientar};
