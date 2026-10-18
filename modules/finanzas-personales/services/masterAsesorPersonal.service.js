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
  const partes=resultado.ventanas.map((v,i)=>{const desde=i===0?0:resultado.ventanas[i-1].dias;return "Días "+(desde+1)+" al "+v.dias+": "+v.numeroIngresosTramo+" ingreso(s) programado(s), "+v.numeroObligacionesTramo+" pago(s) con fecha por "+moneda(v.obligacionesTramoMinor)+"; acumulado de obligaciones hasta aquí: "+moneda(v.obligacionesConFechaMinor)+".";});
  const alertas=[];
  if(resultado.ingresosSinProgramar)alertas.push("No hay ingresos futuros programados en el calendario: NO significa que tus ingresos sean cero.");
  if(resultado.deudasSinPeriodicidadConfirmada){const nombres=(resultado.deudasParaConfirmar||[]).map(x=>x.concepto+" (cuota "+moneda(x.cuotaMinor)+")");alertas.push("Falta confirmar si las cuotas de "+nombres.join(", ")+" se repiten cada mes. Por seguridad se consideró solo la fecha registrada.");}
  if(resultado.obligacionesSinFecha)alertas.push("Hay "+resultado.obligacionesSinFecha+" deuda(s) sin vencimiento conocido.");
  const conclusion="Estos tramos son diferentes; cuando el acumulado se repite significa que no se registraron eventos adicionales, no que haya nuevos cobros o pagos. Tampoco es un presupuesto completo."; 
  const paso=resultado.deudasSinPeriodicidadConfirmada?"¿La cuota de la deuda mencionada se paga todos los meses en el mismo día?":resultado.ingresosSinProgramar?"¿Recibes ingresos periódicos? Indícame monto y fecha habitual para evaluar un calendario, sin registrarlo sin tu autorización.":"Revisa tus gastos variables y saldo real antes de comprometer más dinero."; 
  return{tipo:"PROYECCION_PARCIAL_30_60_90",respuesta:"Análisis por períodos de 30 días. "+partes.join(" ")+" "+conclusion+" "+alertas.join(" ")+" "+paso+" No se registraron operaciones.",datos:resultado};
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
